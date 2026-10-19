// Generates the behavior pack and resource pack into build/, and the Java edition's
// resources into java/src/generated/resources (tools/java.mjs).
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { machineAnimation } from '../src/lib/anim.mjs';
import { buildEntity, buildLoot, floatJson, runtimeRecord } from '../src/lib/behavior.mjs';
import { buildClientEntity, buildRenderController } from '../src/lib/client.mjs';
import { MIN_ENGINE, NS, PACK_NAME, SCRIPT_SERVER_VERSION, SCRIPT_UI_VERSION } from '../src/lib/constants.mjs';
import { packIcon } from '../src/lib/icon.mjs';
import { loadMachines, restValues } from '../src/lib/machines.mjs';
import { buildGeometry } from '../src/lib/model.mjs';
import { paintTexture } from '../src/lib/texture.mjs';
import { langEntries, LOCALES } from '../src/lang.mjs';
import { buildItem, items as itemsFor, recipes as recipesFor } from '../src/items.mjs';
import { blocks } from '../src/blocks.mjs';
import { bedrockId, DIG, DROPS, kindOf, LIFT, MIXABLE, NEVER } from '../src/diggable.mjs';
import { render } from './render.mjs';
import { buildJava } from './java.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const BP = join(OUT, 'behavior_pack');
const RP = join(OUT, 'resource_pack');

const UUID = {
  bpHeader: '4f1c2a8e-7b3d-4e61-9a52-c1d0e8f3a701',
  bpData: '8a2e6b14-35c9-4f7d-b0e2-6d91c4a5f812',
  bpScript: 'c3d7f9a0-1e24-4b8c-a6f5-2b80e9d14c23',
  rpHeader: 'e9b40c71-6a2d-4f38-8c15-7f3a2d6b9e34',
  rpResources: '1d5f8e2a-9c47-4b06-bd31-a4e6c8f02b45',
};

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
}

function manifests(version) {
  const v = version.split('.').map(Number);
  const meta = { authors: ['Construction Machines contributors'], license: 'MIT' };
  const bp = {
    format_version: 2,
    header: { name: `${PACK_NAME} v${version} (Behavior)`, description: 'pack.description', uuid: UUID.bpHeader, version: v, min_engine_version: MIN_ENGINE },
    modules: [
      { type: 'data', uuid: UUID.bpData, version: v },
      { type: 'script', language: 'javascript', uuid: UUID.bpScript, version: v, entry: 'scripts/main.js' },
    ],
    dependencies: [
      { uuid: UUID.rpHeader, version: v },
      { module_name: '@minecraft/server', version: SCRIPT_SERVER_VERSION },
      { module_name: '@minecraft/server-ui', version: SCRIPT_UI_VERSION },
    ],
    metadata: meta,
  };
  const rp = {
    format_version: 2,
    header: { name: `${PACK_NAME} v${version} (Resources)`, description: 'pack.description', uuid: UUID.rpHeader, version: v, min_engine_version: MIN_ENGINE },
    modules: [{ type: 'resources', uuid: UUID.rpResources, version: v }],
    dependencies: [{ uuid: UUID.bpHeader, version: v }],
    metadata: meta,
  };
  return { bp, rp };
}

/** Moving booms reach far outside the rest pose: widen the culling bounds. */
function widenBounds(geo, m) {
  const d = geo.geometry['minecraft:geometry'][0].description;
  if (m.bounds) {
    d.visible_bounds_width = m.bounds.width;
    d.visible_bounds_height = m.bounds.height;
    d.visible_bounds_offset = [0, m.bounds.height / 2 - 1, 0];
  } else {
    d.visible_bounds_width = Math.ceil(d.visible_bounds_width * 1.6) + 2;
    d.visible_bounds_height = Math.ceil(d.visible_bounds_height * 1.5) + 2;
  }
}

/** Shared lists for the scripts, in Bedrock ids. */
function terrainData() {
  const drops = {};
  for (const id of DIG) {
    const to = id in DROPS ? DROPS[id] : id;
    drops[bedrockId(id)] = to === null ? null : bedrockId(to);
  }
  const kinds = {};
  for (const id of new Set([...DIG, ...LIFT, ...Object.values(DROPS).filter(Boolean)])) kinds[bedrockId(id)] = kindOf(id);
  return {
    DIG: DIG.map(bedrockId), LIFT: [...DIG, ...LIFT].map(bedrockId), NEVER: NEVER.map(bedrockId),
    DROPS: drops, KINDS: kinds, MIXABLE: MIXABLE.map(bedrockId),
  };
}

export async function build({ quiet = false } = {}) {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  await rm(BP, { recursive: true, force: true });
  await rm(RP, { recursive: true, force: true });
  for (const [from, to] of [['behavior_pack', BP], ['resource_pack', RP]]) {
    if (existsSync(join(ROOT, 'src', 'packs', from))) await cp(join(ROOT, 'src', 'packs', from), to, { recursive: true });
  }

  const { bp, rp } = manifests(pkg.version);
  await write(join(BP, 'manifest.json'), bp);
  await write(join(RP, 'manifest.json'), rp);
  const icon = packIcon();
  await write(join(BP, 'pack_icon.png'), icon);
  await write(join(RP, 'pack_icon.png'), icon);

  const machines = await loadMachines();
  const java = { geos: {}, anims: {}, textures: {}, records: [] };
  const report = [];
  for (const m of machines) {
    await write(join(BP, 'entities', `${m.id}.json`), floatJson(buildEntity(m)));
    await write(join(BP, 'loot_tables', 'entities', `${NS}_${m.id}.json`), buildLoot(m));

    const geo = buildGeometry(`geometry.${NS}.${m.id}`, m.model);
    widenBounds(geo, m);
    const texture = paintTexture(geo, m.materials);
    await write(join(RP, 'models', 'entity', `${m.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${m.id}.png`), texture);
    await write(join(RP, 'animations', `${m.id}.animation.json`), machineAnimation(m, 'bedrock'));
    await write(join(RP, 'entity', `${m.id}.entity.json`), buildClientEntity(m));
    await write(join(RP, 'render_controllers', `${m.id}.render_controllers.json`), buildRenderController(m));

    // Portrait for the Machine Manual.
    const anim = Object.values(machineAnimation(m, 'preview').animations)[0];
    await write(join(RP, 'textures', 'ui', NS, `${m.id}.png`), render(geo.geometry, texture, { yaw: 35, size: 64, anim, vars: restValues(m) }));

    java.geos[m.id] = geo.geometry;
    java.anims[m.id] = machineAnimation(m, 'java');
    java.textures[m.id] = texture;
    java.records.push(runtimeRecord(m));
    report.push(`${m.id} (${geo.width}x${geo.height})`);
  }

  // Data for the scripts, and the kinematics they share with the build.
  const records = machines.map(runtimeRecord);
  const itemList = itemsFor(machines);
  await write(join(BP, 'scripts', 'data.js'), [
    '// Generated by tools/build.mjs',
    `export const MACHINES = ${JSON.stringify(records)};`,
    `export const TERRAIN = ${JSON.stringify(terrainData())};`,
    `export const ITEMS = ${JSON.stringify([...itemList.map((i) => `${NS}:${i.id}`), ...blocks.map((b) => `${NS}:${b.id}`)])};`,
    '',
  ].join('\n'));
  await copyFile(join(ROOT, 'src', 'lib', 'kinematics.mjs'), join(BP, 'scripts', 'kinematics.js'));

  // Items
  const itemTextures = {};
  for (const item of itemList) {
    await write(join(BP, 'items', `${item.id}.json`), buildItem(item));
    await write(join(RP, 'textures', 'items', NS, `${item.id}.png`), item.icon);
    itemTextures[`${NS}_${item.id}`] = { textures: `textures/items/${NS}/${item.id}` };
  }
  await write(join(RP, 'textures', 'item_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.items', texture_data: itemTextures });

  // Blocks
  const terrain = {};
  const blockSounds = { format_version: [1, 1, 0] };
  for (const block of blocks) {
    await write(join(BP, 'blocks', `${block.id}.json`), block.definition);
    await write(join(RP, 'models', 'blocks', `${block.id}.geo.json`), block.geometry);
    await write(join(RP, 'textures', 'blocks', NS, `${block.id}.png`), block.texture);
    terrain[`${NS}_${block.id}`] = { textures: `textures/blocks/${NS}/${block.id}` };
    blockSounds[`${NS}:${block.id}`] = { sound: block.sound ?? 'stone' };
  }
  await write(join(RP, 'textures', 'terrain_texture.json'), { resource_pack_name: NS, texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: terrain });
  await write(join(RP, 'blocks.json'), blockSounds);

  const recipes = recipesFor(itemList);
  for (const recipe of recipes) {
    const body = Object.values(recipe)[0];
    await write(join(BP, 'recipes', `${body.description.identifier.split(':')[1]}.json`), { format_version: '1.12', ...recipe });
  }

  // Language
  const langs = {};
  for (const locale of LOCALES) {
    const entries = langEntries(locale, { machines, items: itemList, blocks, description: pkg.description, version: pkg.version });
    langs[locale] = entries;
    const text = entries.map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    for (const pack of [BP, RP]) await write(join(pack, 'texts', `${locale}.lang`), text);
  }
  for (const pack of [BP, RP]) await write(join(pack, 'texts', 'languages.json'), LOCALES);

  await buildJava({
    machines, ...java, items: itemList, blocks, recipes, langs, icon,
    OUT: join(ROOT, 'java', 'src', 'generated', 'resources'),
  });

  if (!quiet) console.log(`Built ${machines.length} machines: ${report.join(', ')}\nItems: ${itemList.map((i) => i.id).join(', ')}`);
  return { machines, items: itemList, version: pkg.version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
