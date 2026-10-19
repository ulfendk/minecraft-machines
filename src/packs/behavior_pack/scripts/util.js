import { world } from '@minecraft/server';
import { MACHINES } from './data.js';
import { pointOn, toLocal, toWorld } from './kinematics.js';

export const NS = 'machines';
export const SPECS = Object.fromEntries(MACHINES.map((m) => [`${NS}:${m.id}`, m]));
export const specOf = (entity) => SPECS[entity.typeId];

/** All machines that are near at least one player (cheap enough to poll). */
export function machinesNearPlayers(radius = 64) {
  const out = new Map();
  for (const player of world.getPlayers()) {
    let found;
    try {
      found = player.dimension.getEntities({ families: ['machine'], location: player.location, maxDistance: radius });
    } catch {
      continue;
    }
    for (const e of found) out.set(e.id, e);
  }
  return [...out.values()];
}

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const floor = (v) => ({ x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) });
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

/** Channel values of a machine, as { c0, c1, ... } and as an array. */
export function channels(entity, spec) {
  const values = {};
  spec.channels.forEach((c, i) => {
    let v = c.rest;
    try { v = entity.getProperty(`${NS}:c${i}`) ?? c.rest; } catch {}
    values[`c${i}`] = v;
  });
  return values;
}

/** World position of a point on the machine's model (pixels), following its moving parts. */
export function modelPoint(entity, spec, chain, at, values = channels(entity, spec)) {
  const local = toLocal(chain.length ? pointOn(chain, spec.drivers, values, at) : at, spec.scale);
  const [x, y, z] = toWorld(local, entity.getRotation().y);
  return add(entity.location, { x, y, z });
}

/** The tool tip (bucket teeth, hook, forks, chute end) in world space. */
export function tip(entity, spec) {
  if (!spec.tool.tip) return entity.location;
  return modelPoint(entity, spec, spec.tool.tip.chain, spec.tool.tip.at);
}

/** Who drives a machine: the first rider, if it is a player. */
export function operatorOf(entity) {
  try {
    const riders = entity.getComponent('minecraft:rideable')?.getRiders() ?? [];
    return riders[0]?.typeId === 'minecraft:player' ? riders[0] : undefined;
  } catch {
    return undefined;
  }
}

/** The machine a player is driving, if any. */
export function drivenBy(player) {
  try {
    const m = player.getComponent('minecraft:riding')?.entityRidingOn;
    if (m && specOf(m) && operatorOf(m)?.id === player.id) return m;
  } catch {}
  return undefined;
}

export function forward(entity) {
  const a = (entity.getRotation().y * Math.PI) / 180;
  return { x: -Math.sin(a), y: 0, z: Math.cos(a) };
}
