// Per-machine state that must survive a reload (load, carried block or entity) is kept in
// entity dynamic properties; the rest lives in memory.
import { NS } from './util.js';

const memory = new Map();

/** In-memory state for a machine (tick counters, last position, ...). */
export function mem(entity) {
  let s = memory.get(entity.id);
  if (!s) memory.set(entity.id, (s = { ticks: 0, last: entity.location, mode: 0, prevYaw: entity.getRotation().y }));
  return s;
}

export function forget(id) {
  memory.delete(id);
}

/** The load: { itemId: count }. */
export function getLoad(entity) {
  try {
    return JSON.parse(entity.getDynamicProperty(`${NS}:load`) ?? '{}');
  } catch {
    return {};
  }
}

export function setLoad(entity, load, capacity) {
  const total = Object.values(load).reduce((a, b) => a + b, 0);
  try {
    entity.setDynamicProperty(`${NS}:load`, JSON.stringify(load));
    entity.setProperty(`${NS}:load`, Math.min(1, total / Math.max(1, capacity)));
  } catch {}
  return total;
}

export const total = (load) => Object.values(load).reduce((a, b) => a + b, 0);

/** Removes one item from the load (oldest kind first) and returns its id. */
export function takeOne(load) {
  const id = Object.keys(load)[0];
  if (!id) return undefined;
  if (--load[id] <= 0) delete load[id];
  return id;
}

export function getString(entity, key) {
  try {
    return entity.getDynamicProperty(`${NS}:${key}`);
  } catch {
    return undefined;
  }
}

export function setString(entity, key, value) {
  try {
    entity.setDynamicProperty(`${NS}:${key}`, value);
  } catch {}
}
