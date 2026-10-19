// Placing machines, building tower cranes from the kit and climbing up the mast.
import { GameMode, system, world } from '@minecraft/server';
import { block, isAir } from './terrain.js';
import { NS, operatorOf, specOf } from './util.js';

const HEIGHTS = [12, 20, 32];
const FACES = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] };

function consume(player) {
  try {
    if (player.getGameMode() === GameMode.Creative) return;
    const inv = player.getComponent('minecraft:inventory').container;
    const slot = player.selectedSlotIndex;
    const item = inv.getItem(slot);
    if (!item) return;
    if (item.amount > 1) {
      item.amount -= 1;
      inv.setItem(slot, item);
    } else {
      inv.setItem(slot);
    }
  } catch {}
}

function spawnMachine(dim, id, loc, yaw) {
  const m = dim.spawnEntity(`${NS}:${id}`, loc);
  m.setRotation({ x: 0, y: yaw });
  return m;
}

/** Builds a mast of `height` blocks on `base` with the crane on top; undefined if there is no room. */
export function buildTowerCrane(dim, base, height, yaw) {
  for (let y = 0; y < height + 3; y++) {
    const b = block(dim, { x: base.x, y: base.y + y, z: base.z });
    if (!b || !isAir(b)) return undefined;
  }
  for (let y = 0; y < height; y++) block(dim, { x: base.x, y: base.y + y, z: base.z }).setType(`${NS}:crane_mast`);
  const top = spawnMachine(dim, 'tower_crane', { x: base.x + 0.5, y: base.y + height, z: base.z + 0.5 }, yaw);
  dim.playSound('random.anvil_use', base, { volume: 0.8, pitch: 0.8 });
  return top;
}

const kitHeight = (player) => Number(player.getDynamicProperty(`${NS}:kit_height`) ?? HEIGHTS[0]);

export function setupPlacing() {
  system.beforeEvents.startup.subscribe(({ itemComponentRegistry, blockComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent(`${NS}:placer`, {
      onUseOn(e) {
        const player = e.source;
        if (player?.typeId !== 'minecraft:player') return;
        const id = e.itemStack.typeId.split(':')[1];
        const [dx, dy, dz] = FACES[e.blockFace] ?? [0, 1, 0];
        const at = { x: e.block.location.x + dx, y: e.block.location.y + dy, z: e.block.location.z + dz };
        const yaw = player.getRotation().y;
        system.run(() => {
          if (id === 'tower_crane_kit') {
            if (e.blockFace !== 'Up') return;
            if (!buildTowerCrane(player.dimension, at, kitHeight(player), yaw)) {
              player.onScreenDisplay.setActionBar({ translate: `${NS}.no_room` });
              return;
            }
          } else {
            spawnMachine(player.dimension, id, { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, yaw);
            player.dimension.playSound('random.anvil_use', at, { volume: 0.5, pitch: 1.2 });
          }
          consume(player);
        });
      },
      onUse(e) {
        if (e.itemStack?.typeId !== `${NS}:tower_crane_kit`) return;
        const player = e.source;
        const next = HEIGHTS[(HEIGHTS.indexOf(kitHeight(player)) + 1) % HEIGHTS.length];
        system.run(() => {
          player.setDynamicProperty(`${NS}:kit_height`, next);
          player.onScreenDisplay.setActionBar({ rawtext: [{ translate: `${NS}.kit.height`, with: [String(next)] }] });
          player.playSound('random.click');
        });
      },
    });
    // Right-click the mast to ride up into the cab.
    blockComponentRegistry.registerCustomComponent(`${NS}:mast`, {
      onPlayerInteract(e) {
        const player = e.player;
        if (!player) return;
        let top = e.block.location;
        for (let i = 0; i < 64; i++) {
          const above = block(e.block.dimension, { x: top.x, y: top.y + 1, z: top.z });
          if (above?.typeId !== `${NS}:crane_mast`) break;
          top = above.location;
        }
        const cranes = e.block.dimension.getEntities({ type: `${NS}:tower_crane`, location: { x: top.x + 0.5, y: top.y + 1, z: top.z + 0.5 }, maxDistance: 1.5 });
        if (cranes[0]) system.run(() => cranes[0].getComponent('minecraft:rideable')?.addRider(player));
      },
    });
  });

  // Getting out of a tower crane puts you at the bottom of the mast instead of 30 blocks up.
  const riding = new Map();
  system.runInterval(() => {
    for (const [craneId, { player, crane, base }] of riding) {
      if (!player.isValid) { riding.delete(craneId); continue; }
      const still = crane.isValid && operatorOf(crane)?.id === player.id;
      if (!still) {
        riding.delete(craneId);
        system.runTimeout(() => {
          try { player.teleport({ x: base.x + 1.5, y: base.y, z: base.z + 0.5 }); } catch {}
        }, 2);
      }
    }
    for (const player of world.getPlayers()) {
      const crane = player.getComponent('minecraft:riding')?.entityRidingOn;
      if (!crane || specOf(crane)?.drive.type !== 'none' || riding.has(crane.id)) continue;
      let base = { x: Math.floor(crane.location.x), y: Math.floor(crane.location.y) - 1, z: Math.floor(crane.location.z) };
      for (let i = 0; i < 64 && block(crane.dimension, { x: base.x, y: base.y - 1, z: base.z })?.typeId === `${NS}:crane_mast`; i++) base = { ...base, y: base.y - 1 };
      riding.set(crane.id, { player, crane, base });
    }
  }, 5);
}
