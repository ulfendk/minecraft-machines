// Bedrock controls. There are no custom keys, so the hotbar slot picks a mode:
//   slot 1 Drive  - the movement keys/stick drive the machine as usual
//   slot 2 Arm    - left/right works channel 1, forward/back channel 2
//   slot 3 Tool   - left/right works channel 4, forward/back channel 3
// Jump is the action button and sneak still gets you out, in every mode.
import { ButtonState, InputButton, system, world } from '@minecraft/server';
import { action, interact } from './tools.js';
import { mem } from './state.js';
import { drivenBy, NS, specOf } from './util.js';

const MODE_NAMES = ['mode.0', 'mode.1', 'mode.2'];

function modeOf(player) {
  const slot = player.selectedSlotIndex;
  return slot === 1 ? 1 : slot === 2 ? 2 : 0;
}

/** Moves a channel by `dir` steps of its rate, within its range (or round, for slewing). */
function nudge(m, spec, i, dir) {
  const c = spec.channels[i];
  if (!c || !dir) return false;
  const key = `${NS}:c${i}`;
  const before = m.getProperty(key);
  let v = before + dir * c.rate;
  if (c.wrap) {
    if (v > 180) v -= 360;
    if (v < -180) v += 360;
  } else {
    v = Math.max(c.min, Math.min(c.max, v));
  }
  if (v === before) return false;
  m.setProperty(key, Math.round(v * 1000) / 1000);
  return true;
}

const axis = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);

function hud(player, m, spec, mode) {
  const parts = [{ text: '§e' }, { translate: `${NS}.${MODE_NAMES[mode]}` }, { text: '§r  ' }];
  if (mode === 0) {
    parts.push({ translate: `${NS}.hud.drive` });
  } else {
    const [lr, fb] = mode === 1 ? [0, 1] : [3, 2];
    for (const [i, label] of [[lr, 'hud.lr'], [fb, 'hud.fb']]) {
      if (!spec.channels[i]) continue;
      parts.push({ translate: `${NS}.${label}` }, { text: ': ' }, { translate: `${NS}.channel.${spec.id}.${i}` }, { text: '  ' });
    }
  }
  parts.push({ text: '§7·§r ' }, { translate: `${NS}.hud.jump` }, { text: ': ' }, { translate: `${NS}.action.${spec.id}` });
  if (spec.tool.capacity) {
    let load = 0;
    try { load = m.getProperty(`${NS}:load`); } catch {}
    parts.push({ text: `  §7·§r ` }, { translate: `${NS}.hud.load` }, { text: ` ${Math.round(load * spec.tool.capacity)}/${spec.tool.capacity}` });
  }
  parts.push({ text: '\n§7' }, { translate: `${NS}.hud.slots` });
  player.onScreenDisplay.setActionBar({ rawtext: parts });
}

let tick = 0;

function controlTick() {
  tick++;
  for (const player of world.getPlayers()) {
    const m = drivenBy(player);
    if (!m) continue;
    const spec = specOf(m);
    const s = mem(m);
    const mode = spec.drive.type === 'none' && modeOf(player) === 0 ? 1 : modeOf(player);
    if (s.mode !== mode) {
      s.mode = mode;
      try {
        m.setProperty(`${NS}:mode`, mode);
        if (spec.drive.type !== 'none') m.triggerEvent(mode === 0 ? `${NS}:drive` : `${NS}:operate`);
      } catch {}
    }
    if (!s.tutorial) {
      s.tutorial = true;
      if (!player.getDynamicProperty(`${NS}:tutorial`)) {
        player.setDynamicProperty(`${NS}:tutorial`, true);
        player.sendMessage({ translate: `${NS}.tutorial` });
      }
    }
    if (mode !== 0) {
      let v;
      try {
        v = player.inputInfo.getMovementVector();
      } catch {
        v = { x: 0, y: 0 };
      }
      const [lr, fb] = mode === 1 ? [0, 1] : [3, 2];
      // Joystick right / D is "+" for the left-right channel, forward / W is "+" for the other.
      const moved = nudge(m, spec, lr, -axis(v.x)) | nudge(m, spec, fb, axis(v.y));
      if (moved && tick - (s.sound ?? 0) > 6) {
        s.sound = tick;
        m.dimension.playSound('tile.piston.out', m.location, { volume: 0.25, pitch: 1.6 });
      }
    }
    if (tick % 5 === 0) hud(player, m, spec, mode);
  }
}

export function setupControls() {
  system.runInterval(controlTick, 1);
  world.afterEvents.playerButtonInput.subscribe(({ button, newButtonState, player }) => {
    if (button !== InputButton.Jump || newButtonState !== ButtonState.Pressed) return;
    const m = drivenBy(player);
    if (m) system.run(() => action(m));
  });
  // Give the mixer sand or a dye by using it on the truck.
  world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
    const spec = specOf(e.target);
    if (!spec || spec.tool.kind !== 'drum' || !e.itemStack) return;
    const item = e.itemStack;
    if (!item.typeId.endsWith('_dye') && !['minecraft:sand', 'minecraft:red_sand', 'minecraft:gravel'].includes(item.typeId)) return;
    e.cancel = true;
    system.run(() => {
      const used = interact(e.target, e.player, item);
      if (typeof used === 'number' && used > 0) {
        const inv = e.player.getComponent('minecraft:inventory')?.container;
        const slot = e.player.selectedSlotIndex;
        const held = inv?.getItem(slot);
        if (held && held.typeId === item.typeId) {
          if (held.amount > used) {
            held.amount -= used;
            inv.setItem(slot, held);
          } else {
            inv.setItem(slot);
          }
        }
      }
    });
  });
}
