// Static checks for build/. The dedicated server validates the behavior pack (tools/bds-test.sh);
// this mostly covers the resource pack, which only clients load, and the Java resources.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const BP = 'build/behavior_pack';
const RP = 'build/resource_pack';
const JAVA = 'java/src/generated/resources';
const errors = [];
const err = (msg) => errors.push(msg);

async function files(dir, ext) {
  const out = [];
  async function walk(d) {
    let names;
    try { names = await readdir(d); } catch { return; }
    for (const n of names) {
      const p = join(d, n);
      if ((await stat(p)).isDirectory()) await walk(p);
      else if (!ext || n.endsWith(ext)) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

async function json(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    err(`${path}: invalid JSON (${e.message})`);
    return null;
  }
}

const exists = (p) => stat(p).then(() => true, () => false);

// ------------------------------------------------------------ load everything
const bpEntities = new Map();
for (const f of await files(join(BP, 'entities'), '.json')) {
  const j = await json(f);
  if (j) bpEntities.set(j['minecraft:entity'].description.identifier, { file: f, json: j });
}

const geometries = new Map();
for (const f of await files(join(RP, 'models'), '.json')) {
  const j = await json(f);
  for (const g of j?.['minecraft:geometry'] ?? []) geometries.set(g.description.identifier, { file: f, g });
}

const animations = new Map();
for (const f of await files(join(RP, 'animations'), '.json')) {
  const j = await json(f);
  for (const [k, v] of Object.entries(j?.animations ?? {})) animations.set(k, v);
}

const renderControllers = new Map();
for (const f of await files(join(RP, 'render_controllers'), '.json')) {
  const j = await json(f);
  for (const [k, v] of Object.entries(j?.render_controllers ?? {})) renderControllers.set(k, v);
}

const readLang = async (file) => new Map(
  (await readFile(file, 'utf8')).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const lang = await readLang(join(RP, 'texts', 'en_US.lang'));

const customItems = new Map();
for (const f of await files(join(BP, 'items'), '.json')) {
  const j = await json(f);
  if (j) customItems.set(j['minecraft:item'].description.identifier, j);
}
for (const f of await files(join(BP, 'blocks'), '.json')) {
  const j = await json(f);
  if (j) customItems.set(j['minecraft:block'].description.identifier, j);
}

// ------------------------------------------------------------ checks
function balanced(expr, where) {
  if (typeof expr !== 'string') return;
  let depth = 0;
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) err(`${where}: unbalanced parentheses in Molang "${expr}"`);
}

async function checkTexture(path, where, size) {
  const file = `${join(RP, path)}.png`;
  if (!(await exists(file))) return err(`${where}: missing texture ${file}`);
  const png = PNG.sync.read(await readFile(file));
  if (size && (png.width !== size[0] || png.height !== size[1])) {
    err(`${where}: texture ${file} is ${png.width}x${png.height}, geometry expects ${size[0]}x${size[1]}`);
  }
}

/** Every q.property / v.* a Molang expression reads must exist. */
function checkMolang(expr, where, props, vars) {
  if (typeof expr !== 'string') return;
  balanced(expr, where);
  for (const [, p] of expr.matchAll(/q(?:uery)?\.property\('([^']+)'\)/g)) if (!props.has(p)) err(`${where}: reads undeclared property ${p}`);
  for (const [, v] of expr.matchAll(/\bv(?:ariable)?\.([a-z_0-9]+)/g)) if (!vars.has(v)) err(`${where}: reads v.${v}, which pre_animation never sets`);
}

const clientIds = new Set();
for (const f of await files(join(RP, 'entity'), '.json')) {
  const j = await json(f);
  if (!j) continue;
  const d = j['minecraft:client_entity'].description;
  const where = `${f} (${d.identifier})`;
  clientIds.add(d.identifier);
  const bp = bpEntities.get(d.identifier);
  if (!bp) err(`${where}: no behavior entity with this identifier`);
  const props = new Map(Object.entries(bp?.json['minecraft:entity'].description.properties ?? {}));
  if (props.size > 32) err(`${where}: ${props.size} properties (at most 32)`);

  const g = geometries.get(d.geometry.default)?.g;
  if (!g) err(`${where}: unknown geometry ${d.geometry.default}`);
  const bones = new Set(g?.bones.map((b) => b.name) ?? []);
  const texSize = g ? [g.description.texture_width, g.description.texture_height] : null;
  for (const t of Object.values(d.textures)) await checkTexture(t, where, texSize);

  if (g) {
    for (const b of g.bones) {
      if (b.parent && !bones.has(b.parent)) err(`${where}: bone ${b.name} has unknown parent ${b.parent}`);
      for (const c of b.cubes ?? []) {
        const [w, h, dd] = c.size;
        const [u, v] = c.uv;
        if (u + 2 * (w + dd) > texSize[0] || v + dd + h > texSize[1]) err(`${where}: cube in bone ${b.name} has UVs outside the texture`);
      }
    }
  }

  // Variables set by pre_animation, then every animation expression.
  const vars = new Set();
  for (const line of d.scripts?.pre_animation ?? []) {
    balanced(line, `${where}: pre_animation`);
    const m = line.match(/^v(?:ariable)?\.([a-z_0-9]+)\s*=/);
    if (m) vars.add(m[1]);
    for (const [, p] of line.matchAll(/q(?:uery)?\.property\('([^']+)'\)/g)) if (!props.has(p)) err(`${where}: pre_animation reads undeclared property ${p}`);
  }
  for (const [short, full] of Object.entries(d.animations ?? {})) {
    const anim = animations.get(full);
    if (!anim) { err(`${where}: unknown animation ${full} (${short})`); continue; }
    for (const [bone, channels] of Object.entries(anim.bones ?? {})) {
      if (!bones.has(bone)) err(`${where}: animation ${full} moves bone "${bone}" that the model does not have`);
      for (const values of Object.values(channels)) for (const e of [values].flat()) checkMolang(e, `${where}: ${full}.${bone}`, props, vars);
    }
  }
  for (const a of d.scripts?.animate ?? []) {
    const n = typeof a === 'string' ? a : Object.keys(a)[0];
    if (!d.animations?.[n]) err(`${where}: scripts.animate uses unknown animation "${n}"`);
  }
  for (const name of d.render_controllers ?? []) {
    if (!renderControllers.has(typeof name === 'string' ? name : Object.keys(name)[0])) err(`${where}: unknown render controller ${name}`);
  }
  if (!lang.has(`entity.${d.identifier}.name`)) err(`${where}: missing lang key entity.${d.identifier}.name`);
}
for (const id of bpEntities.keys()) if (!clientIds.has(id)) err(`${id}: behavior entity has no client entity`);

// Behavior entities: rideable seats, events for every component group, loot.
for (const [id, { json: j }] of bpEntities) {
  const e = j['minecraft:entity'];
  const seats = e.components['minecraft:rideable']?.seats ?? [];
  if (!seats.length) err(`${id}: no seats`);
  for (const [name, ev] of Object.entries(e.events ?? {})) {
    for (const g of [...(ev.add?.component_groups ?? []), ...(ev.remove?.component_groups ?? [])]) {
      if (!e.component_groups?.[g]) err(`${id}: event ${name} uses unknown component group ${g}`);
    }
  }
  for (const [name, p] of Object.entries(e.description.properties ?? {})) {
    if (p.type === 'float' && (p.range[0] > p.range[1])) err(`${id}: property ${name} has an empty range`);
  }
  const table = e.components['minecraft:loot']?.table;
  const lt = table && (await exists(join(BP, table))) ? await json(join(BP, table)) : null;
  if (!lt) { err(`${id}: missing loot table ${table}`); continue; }
  for (const pool of lt.pools ?? []) for (const entry of pool.entries ?? []) {
    if (entry.type === 'item' && !entry.name.startsWith('minecraft:') && !customItems.has(entry.name)) err(`${table}: drops unknown item ${entry.name}`);
  }
}

// Items and blocks: icon textures and names
const itemAtlas = (await json(join(RP, 'textures', 'item_texture.json')))?.texture_data ?? {};
const terrainAtlas = (await json(join(RP, 'textures', 'terrain_texture.json')))?.texture_data ?? {};
for (const [id, j] of customItems) {
  if (j['minecraft:block']) {
    const tex = j['minecraft:block'].components['minecraft:material_instances']?.['*']?.texture;
    if (!terrainAtlas[tex]) err(`${id}: texture "${tex}" is not in terrain_texture.json`);
    else await checkTexture(terrainAtlas[tex].textures, id, [16, 16]);
    if (!lang.has(`tile.${id}.name`)) err(`${id}: missing lang key tile.${id}.name`);
    continue;
  }
  const key = j['minecraft:item'].components['minecraft:icon'];
  if (!itemAtlas[key]) err(`${id}: icon "${key}" is not in item_texture.json`);
  else await checkTexture(itemAtlas[key].textures, id, [16, 16]);
  if (!lang.has(`item.${id}.name`)) err(`${id}: missing lang key item.${id}.name`);
}

// Recipes only use items that exist.
for (const f of await files(join(BP, 'recipes'), '.json')) {
  const j = await json(f);
  const body = Object.values(j).find((v) => v && typeof v === 'object');
  const refs = [...Object.values(body.key ?? {}).map((k) => k.item), ...(body.ingredients ?? []).map((i) => i.item), body.result?.item];
  for (const id of refs) if (id?.startsWith('machines:') && !customItems.has(id)) err(`${f}: unknown item ${id}`);
}

// Languages: every locale has exactly the keys English has, all non-empty; and the
// keys the scripts and the manual build from machine data exist.
const locales = (await json(join(RP, 'texts', 'languages.json'))) ?? [];
for (const locale of locales) {
  for (const pack of [BP, RP]) {
    const file = join(pack, 'texts', `${locale}.lang`);
    if (!(await exists(file))) { err(`${file}: missing`); continue; }
    const l = await readLang(file);
    for (const k of lang.keys()) if (!l.get(k)) err(`${file}: missing or empty "${k}"`);
    for (const k of l.keys()) if (!lang.has(k)) err(`${file}: "${k}" is not in en_US.lang`);
  }
}
const dataSrc = await readFile(join(BP, 'scripts', 'data.js'), 'utf8');
const machines = JSON.parse(dataSrc.match(/export const MACHINES = (.*);/)[1]);
for (const m of machines) {
  const keys = [`machines.info.${m.id}`, `machines.action.${m.id}`, ...m.channels.map((c, i) => `machines.channel.${m.id}.${i}`)];
  for (const k of keys) if (!lang.has(k)) err(`${m.id}: missing lang key ${k}`);
  if (!(await exists(join(RP, 'textures', 'ui', 'machines', `${m.id}.png`)))) err(`${m.id}: missing manual portrait`);
}

// Java: the same lang keys in both languages, a model, animation and texture per machine.
const javaEn = await json(join(JAVA, 'assets', 'machines', 'lang', 'en_us.json'));
const javaDa = await json(join(JAVA, 'assets', 'machines', 'lang', 'da_dk.json'));
for (const k of Object.keys(javaEn ?? {})) if (!javaDa?.[k]) err(`Java da_dk.json: missing "${k}"`);
for (const m of machines) {
  for (const p of [`geckolib/models/entity/${m.id}.geo.json`, `geckolib/animations/entity/${m.id}.animation.json`, `textures/entity/${m.id}.png`]) {
    if (!(await exists(join(JAVA, 'assets', 'machines', p)))) err(`Java: missing ${p}`);
  }
  if (!javaEn?.[`entity.machines.${m.id}`]) err(`Java: missing name for ${m.id}`);
}

// Manifests
for (const pack of [BP, RP]) {
  const m = await json(join(pack, 'manifest.json'));
  if (m && (!m.header?.uuid || !Array.isArray(m.header.version))) err(`${pack}/manifest.json: bad header`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${bpEntities.size} machines, ${geometries.size} models, ${animations.size} animations, ${customItems.size} items and blocks`);
