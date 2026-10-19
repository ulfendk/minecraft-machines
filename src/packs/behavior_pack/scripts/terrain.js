// The rules for changing the world, the same as TerrainOps on Java: a world switch,
// no changes for adventure/spectator players, never block entities or protected blocks.
import { GameMode, ItemStack, world } from '@minecraft/server';
import { TERRAIN } from './data.js';
import { add } from './util.js';

const DIG = new Set(TERRAIN.DIG);
const LIFT = new Set(TERRAIN.LIFT);
const NEVER = new Set(TERRAIN.NEVER);
const REPLACEABLE = new Set(['minecraft:air', 'minecraft:water', 'minecraft:flowing_water', 'minecraft:short_grass', 'minecraft:tall_grass',
  'minecraft:fern', 'minecraft:large_fern', 'minecraft:snow_layer', 'minecraft:deadbush', 'minecraft:seagrass', 'minecraft:light_block']);

export const enabled = () => world.getDynamicProperty('machines:terrain') !== false;

export function setEnabled(on) {
  world.setDynamicProperty('machines:terrain', on);
}

export function mayEdit(operator) {
  if (!enabled()) return false;
  if (!operator) return true;
  try {
    const mode = operator.getGameMode();
    return mode !== GameMode.Adventure && mode !== GameMode.Spectator;
  } catch {
    return true;
  }
}

export function block(dim, loc) {
  try {
    return dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
  } catch {
    return undefined;
  }
}

function hasInventory(b) {
  try {
    return !!b.getComponent('minecraft:inventory');
  } catch {
    return false;
  }
}

export const isAir = (b) => !b || b.isAir || REPLACEABLE.has(b.typeId) || TERRAIN.DROPS[b.typeId] === null && DIG.has(b.typeId);

export function canDig(b) {
  return !!b && !b.isAir && DIG.has(b.typeId) && !NEVER.has(b.typeId) && !hasInventory(b);
}

export function canLift(b) {
  return !!b && !b.isAir && LIFT.has(b.typeId) && !NEVER.has(b.typeId) && !hasInventory(b);
}

/** What a dug block adds to a load (null: nothing). */
export function dropOf(b) {
  const d = TERRAIN.DROPS[b.typeId];
  return d === undefined ? b.typeId : d;
}

export function breakBlock(b, operator) {
  if (!mayEdit(operator)) return false;
  try {
    const loc = b.location;
    b.dimension.playSound(TERRAIN.KINDS[b.typeId] === 1 ? 'dig.stone' : TERRAIN.KINDS[b.typeId] === 2 ? 'dig.sand' : 'dig.gravel', loc);
    b.setType('minecraft:air');
    return true;
  } catch {
    return false;
  }
}

export function place(b, id, operator) {
  if (!b || !isAir(b) || !mayEdit(operator)) return false;
  try {
    b.setType(id);
    b.dimension.playSound('dig.gravel', b.location, { pitch: 0.8 });
    return true;
  } catch {
    return false; // not a block (or not placeable here)
  }
}

export function dropItem(dim, loc, id, count = 1) {
  try {
    dim.spawnItem(new ItemStack(id, count), loc);
  } catch {}
}

/**
 * Pours one item like a pile into the lowest free spot of the 3x3 columns below `at`.
 * Items that are not blocks drop as items. Returns false if there was no room.
 */
export function pour(dim, at, id, operator) {
  const top = { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) };
  const spots = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      let p = { x: top.x + dx, y: top.y, z: top.z + dz };
      if (!isAir(block(dim, p))) continue;
      for (let i = 0; i < 24; i++) {
        const below = block(dim, add(p, { x: 0, y: -1, z: 0 }));
        if (!below || !isAir(below)) break;
        p = below.location;
      }
      spots.push({ p, d: Math.abs(dx) + Math.abs(dz) });
    }
  spots.sort((a, b) => a.p.y - b.p.y || a.d - b.d);
  for (const { p } of spots) {
    const b = block(dim, p);
    if (place(b, id, operator)) return true;
    if (b && isAir(b) && mayEdit(operator)) {
      // Not a block: drop it as an item instead.
      try {
        new ItemStack(id, 1);
        dropItem(dim, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }, id);
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

/** Blocks within `r` of a point, nearest first. */
export function around(at, r) {
  const out = [];
  const R = Math.ceil(r);
  const c = { x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z) };
  for (let dx = -R; dx <= R; dx++)
    for (let dy = -R; dy <= R; dy++)
      for (let dz = -R; dz <= R; dz++) {
        const p = { x: c.x + dx, y: c.y + dy, z: c.z + dz };
        const d = (p.x + 0.5 - at.x) ** 2 + (p.y + 0.5 - at.y) ** 2 + (p.z + 0.5 - at.z) ** 2;
        if (d <= r * r) out.push({ p, d });
      }
  return out.sort((a, b) => a.d - b.d).map((o) => o.p);
}
