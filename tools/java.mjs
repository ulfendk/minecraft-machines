// Generates the Java edition's resources (java/src/generated/resources) from the same
// specs as the Bedrock packs. GeckoLib reads the Bedrock geometry and animation formats
// directly, so models and animations are shared.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { NS } from '../src/lib/constants.mjs';
import { pointOn, toLocal } from '../src/lib/kinematics.mjs';
import { DIG, javaId, LIFT, NEVER } from '../src/diggable.mjs';

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
}

async function itemModel(A, id) {
  await write(join(A, 'models', 'item', `${id}.json`), { parent: 'minecraft:item/generated', textures: { layer0: `${NS}:item/${id}` } });
  await write(join(A, 'items', `${id}.json`), { model: { type: 'minecraft:model', model: `${NS}:item/${id}` } });
}

/**
 * Sample channel positions and where the tool tip ends up (entity space, blocks), so the
 * Java kinematics can be checked against the JavaScript ones (MachineGameTests.kinematicsMatch).
 */
export function fkFixtures(records) {
  const out = [];
  for (const r of records) {
    if (!r.tool.tip) continue;
    const samples = [
      Object.fromEntries(r.channels.map((c, i) => [`c${i}`, c.rest])),
      Object.fromEntries(r.channels.map((c, i) => [`c${i}`, c.min])),
      Object.fromEntries(r.channels.map((c, i) => [`c${i}`, c.max])),
      Object.fromEntries(r.channels.map((c, i) => [`c${i}`, (c.min + c.max) / 2 + (i % 2 ? 7 : -5)])),
    ];
    for (const values of samples) {
      const tip = toLocal(pointOn(r.tool.tip.chain, r.drivers, values, r.tool.tip.at), r.scale).map((n) => Math.round(n * 10000) / 10000);
      out.push({ id: r.id, values: r.channels.map((c, i) => values[`c${i}`]), tip });
    }
  }
  return out;
}

function javaRecipe(item) {
  return {
    type: 'minecraft:crafting_shaped',
    category: 'misc',
    pattern: item.recipe.pattern,
    key: Object.fromEntries(Object.entries(item.recipe.key).map(([k, v]) => [k, javaId(v)])),
    result: { id: `${NS}:${item.id}`, count: 1 },
  };
}

const tag = (ids) => ({ replace: false, values: ids.map((id) => ({ id: javaId(id), required: false })) });

export async function buildJava({ machines, geos, anims, textures, records, items, blocks, langs, icon, OUT }) {
  await rm(OUT, { recursive: true, force: true });
  const A = join(OUT, 'assets', NS);
  const D = join(OUT, 'data', NS);

  for (const m of machines) {
    await write(join(A, 'geckolib', 'models', 'entity', `${m.id}.geo.json`), geos[m.id]);
    await write(join(A, 'geckolib', 'animations', 'entity', `${m.id}.animation.json`), anims[m.id]);
    await write(join(A, 'textures', 'entity', `${m.id}.png`), textures[m.id]);
  }
  await write(join(OUT, NS, 'machines.json'), records);
  await write(join(OUT, NS, 'fk_fixtures.json'), fkFixtures(records));

  for (const item of items) {
    await write(join(A, 'textures', 'item', `${item.id}.png`), item.icon);
    await itemModel(A, item.id);
    if (item.recipe) await write(join(D, 'recipe', `${item.id}.json`), javaRecipe(item));
  }
  await write(join(D, 'recipe', 'machine_manual.json'), {
    type: 'minecraft:crafting_shapeless', category: 'misc',
    ingredients: ['minecraft:book', 'minecraft:yellow_dye'], result: { id: `${NS}:machine_manual`, count: 1 },
  });
  await write(join(D, 'recipe', 'crane_mast.json'), {
    type: 'minecraft:crafting_shaped', category: 'building', pattern: ['B B', 'BYB', 'B B'],
    key: { B: 'minecraft:iron_bars', Y: 'minecraft:yellow_dye' }, result: { id: `${NS}:crane_mast`, count: 8 },
  });

  for (const block of blocks) {
    await write(join(A, 'textures', 'block', `${block.id}.png`), block.texture);
    await write(join(A, 'models', 'block', `${block.id}.json`), {
      parent: 'minecraft:block/cube_all', render_type: 'minecraft:cutout', textures: { all: `${NS}:block/${block.id}` },
    });
    await write(join(A, 'blockstates', `${block.id}.json`), { variants: { '': { model: `${NS}:block/${block.id}` } } });
    await write(join(A, 'models', 'item', `${block.id}.json`), { parent: `${NS}:block/${block.id}` });
    await write(join(A, 'items', `${block.id}.json`), { model: { type: 'minecraft:model', model: `${NS}:item/${block.id}` } });
    await write(join(D, 'loot_table', 'blocks', `${block.id}.json`), {
      type: 'minecraft:block',
      pools: [{ rolls: 1, entries: [{ type: 'minecraft:item', name: `${NS}:${block.id}` }], conditions: [{ condition: 'minecraft:survives_explosion' }] }],
    });
  }
  // The mast can be climbed like a ladder.
  await write(join(OUT, 'data', 'minecraft', 'tags', 'block', 'climbable.json'), { replace: false, values: [`${NS}:crane_mast`] });
  await write(join(OUT, 'data', 'minecraft', 'tags', 'block', 'mineable', 'pickaxe.json'), { replace: false, values: [`${NS}:crane_mast`] });

  // What machines may dig and lift (datapacks can add to these).
  await write(join(D, 'tags', 'block', 'diggable.json'), tag(DIG));
  await write(join(D, 'tags', 'block', 'liftable.json'), tag([...DIG, ...LIFT]));
  await write(join(D, 'tags', 'block', 'never.json'), tag(NEVER));
  await write(join(D, 'tags', 'entity_type', 'unliftable.json'), tag(['wither', 'ender_dragon', 'warden', 'elder_guardian']));

  // Language files: Bedrock keys -> Java keys.
  for (const [locale, entries] of Object.entries(langs)) {
    const out = {};
    for (const [k, v] of entries) {
      let m;
      if ((m = k.match(/^entity\.machines:(.+)\.name$/))) out[`entity.${NS}.${m[1]}`] = v;
      else if ((m = k.match(/^item\.machines:(.+)\.name$/))) out[`item.${NS}.${m[1]}`] = v;
      else if ((m = k.match(/^tile\.machines:(.+)\.name$/))) out[`block.${NS}.${m[1]}`] = v;
      else if (k.startsWith(`${NS}.`) || k.startsWith('key.')) out[k] = v;
    }
    out[`itemGroup.${NS}`] = locale === 'da_DK' ? 'Entreprenørmaskiner' : 'Construction Machines';
    out[`gamerule.${NS}.machine_terrain_editing`] = locale === 'da_DK' ? 'Maskiner kan ændre terrænet' : 'Machines can change the terrain';
    await write(join(A, 'lang', `${locale.toLowerCase()}.json`), out);
  }

  await write(join(A, 'icon.png'), icon);
}
