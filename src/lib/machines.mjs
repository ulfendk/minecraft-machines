// Loads the machine specs from src/machines/ and fills in derived data.
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CHANNELS } from './constants.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'machines');

/** Display order everywhere (creative tab, site, manual). */
export const ORDER = [
  'excavator', 'wheel_loader', 'bulldozer', 'dump_truck', 'skid_steer',
  'crawler_crane', 'truck_crane', 'tower_crane',
  'mixer_truck', 'road_roller', 'forklift', 'telehandler',
];

export const GROUPS = ['earthmover', 'crane', 'tower', 'extra'];

export async function loadMachines() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.mjs'));
  const machines = [];
  for (const f of files) machines.push((await import(pathToFileURL(join(DIR, f)).href)).default);
  machines.sort((a, b) => rank(a.id) - rank(b.id));
  for (const m of machines) check(m);
  return machines;
}

const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : 999);

function check(m) {
  const where = `machine ${m.id}`;
  for (const key of ['id', 'name', 'group', 'info', 'scale', 'hitbox', 'health', 'mass', 'seats', 'drive', 'channels', 'tool', 'recipe', 'icon', 'model', 'materials']) {
    if (m[key] === undefined) throw new Error(`${where}: missing "${key}"`);
  }
  if (!GROUPS.includes(m.group)) throw new Error(`${where}: unknown group ${m.group}`);
  if (m.channels.length > CHANNELS) throw new Error(`${where}: at most ${CHANNELS} channels`);
  const bones = new Set(m.model.bones.map((b) => b.name));
  for (const d of [...(m.drivers ?? []), ...(m.visuals ?? [])]) {
    if (!bones.has(d.bone)) throw new Error(`${where}: driver for unknown bone ${d.bone}`);
    for (const [ch] of d.terms ?? []) {
      const i = Number(ch.slice(1));
      if (!/^c\d$/.test(ch) || i >= m.channels.length) throw new Error(`${where}: driver uses unknown channel ${ch}`);
    }
  }
  for (const s of m.seats) if (s.bone && !bones.has(s.bone)) throw new Error(`${where}: seat on unknown bone ${s.bone}`);
  for (const w of m.drive.wheels ?? []) if (!bones.has(w.bone)) throw new Error(`${where}: unknown wheel bone ${w.bone}`);
  if (m.tool.tip && !bones.has(m.tool.tip.bone)) throw new Error(`${where}: tool tip on unknown bone ${m.tool.tip.bone}`);
  for (const c of m.channels) {
    if (!(c.min <= c.rest && c.rest <= c.max)) throw new Error(`${where}: channel ${c.id} rests outside its range`);
  }
}

/** Channel values at rest, as { c0: .., c1: .. }. */
export const restValues = (m) => Object.fromEntries(m.channels.map((c, i) => [`c${i}`, c.rest]));
