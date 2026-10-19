// Renders every machine (at rest, at work, loaded, from several sides) into build/preview/,
// plus a contact sheet of all machines: build/preview/sheet.png.
// `npm run preview excavator` renders only that machine.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from './build.mjs';
import { machineAnimation } from '../src/lib/anim.mjs';
import { restValues } from '../src/lib/machines.mjs';
import { render, sheet } from './render.mjs';

const RP = 'build/resource_pack';
const OUT = 'build/preview';
const only = process.argv.slice(2);

/** Channel values that show a machine working: about two thirds of the way along each channel. */
export const workValues = (m) => Object.fromEntries(m.channels.map((c, i) => [`c${i}`, c.wrap ? 50 : c.rest + (c.max - c.rest) * 0.65]));

const { machines } = await build({ quiet: true });
await mkdir(OUT, { recursive: true });
const thumbs = [];
for (const m of machines) {
  if (only.length && !only.includes(m.id)) continue;
  const geo = JSON.parse(await readFile(join(RP, 'models/entity', `${m.id}.geo.json`), 'utf8'));
  const tex = await readFile(join(RP, 'textures/entity/machines', `${m.id}.png`));
  const anim = Object.values(machineAnimation(m, 'preview').animations)[0];
  const rest = restValues(m), work = workValues(m);
  const loaded = { ...rest, load: 1, kind: 0, carry: 1 };
  const views = [
    render(geo, tex, { anim, vars: rest, yaw: 35 }),
    render(geo, tex, { anim, vars: rest, yaw: 145 }),
    render(geo, tex, { anim, vars: work, yaw: 35 }),
    render(geo, tex, { anim, vars: { ...work, load: 1, kind: 1, carry: 1 }, yaw: 90, pitch: 5 }),
    render(geo, tex, { anim, vars: loaded, yaw: 215, pitch: 35 }),
    render(geo, tex, { anim, vars: rest, yaw: 0, pitch: 89 }),
  ];
  await writeFile(join(OUT, `${m.id}.png`), sheet(views, { cols: 3 }));
  thumbs.push(views[0]);
}
await writeFile(join(OUT, 'sheet.png'), sheet(thumbs, { cols: 4 }));
console.log(`Wrote previews for ${thumbs.length} machines to ${OUT}/`);
