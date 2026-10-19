// Items: a placer for every machine, the tower crane kit and the Machine Manual.
import { NS } from './lib/constants.mjs';
import { pixelIcon } from './lib/texture.mjs';
import { bedrockId } from './diggable.mjs';

const MANUAL_ICON = pixelIcon([
  '................',
  '..kkkkkkkkkkk...',
  '..kyyyyyyyyyyk..',
  '..kyyyyyyyyyyk..',
  '..kykkkyyyyyyk..',
  '..kyykkkyyyyyk..',
  '..kyyykkkyyyyk..',
  '..kyyyykkkyyyk..',
  '..kyyyyyyyyyyk..',
  '..kbkbkbkbkbkk..',
  '..kkbkbkbkbkbk..',
  '..kyyyyyyyyyyk..',
  '..kwwwwwwwwwwk..',
  '..kkkkkkkkkkk...',
  '................',
  '................',
], { k: '#222222', y: '#f2b705', b: '#1b1c1d', w: '#f4ecd8' });

const KIT_ICON = pixelIcon([
  '..r.............',
  '.rrrrrrrrrrrrrr.',
  '..r..r..r..r..k.',
  '..rr...........k',
  '..r.r.........kk',
  '..rr...........k',
  '..r.r...........',
  '..rr............',
  '..r.r...........',
  '..rr............',
  '..r.r...........',
  '..rr............',
  '..r.r...........',
  '..rr............',
  '.gggg...........',
  'gggggg..........',
], { r: '#c8261b', k: '#333333', g: '#7d848a' });

/** Placer items plus the extras, as { id, name, icon, stack, entity?, kind }. */
export function items(machines) {
  const out = machines.map((m) => ({
    id: m.id === 'tower_crane' ? 'tower_crane_kit' : m.id,
    name: m.id === 'tower_crane' ? 'Tower Crane Kit' : m.name,
    icon: m.id === 'tower_crane' ? KIT_ICON : pixelIcon(m.icon.rows, m.icon.palette),
    stack: 1,
    machine: m.id,
    recipe: m.recipe,
  }));
  out.push({ id: 'machine_manual', name: 'Machine Manual', icon: MANUAL_ICON, stack: 1 });
  return out;
}

export function buildItem(item) {
  const components = {
    'minecraft:icon': `${NS}_${item.id}`,
    'minecraft:display_name': { value: `item.${NS}:${item.id}.name` },
    'minecraft:max_stack_size': item.stack ?? 64,
  };
  // Machines are placed by the script (scripts/place.js), which turns them to face the
  // way the player looks and checks that there is room. The tower crane kit builds a mast.
  if (item.machine) components[`${NS}:placer`] = {};
  return {
    format_version: '1.21.90',
    'minecraft:item': {
      description: { identifier: `${NS}:${item.id}`, menu_category: { category: item.machine ? 'items' : 'equipment' } },
      components,
    },
  };
}

/** Shaped recipes for the placers (Bedrock format; tools/java.mjs converts them). */
export function recipes(itemList) {
  const out = [];
  for (const item of itemList) {
    if (!item.recipe) continue;
    out.push({
      'minecraft:recipe_shaped': {
        description: { identifier: `${NS}:${item.id}` },
        tags: ['crafting_table'],
        pattern: item.recipe.pattern,
        key: Object.fromEntries(Object.entries(item.recipe.key).map(([k, v]) => [k, { item: bedrockId(v) }])),
        result: { item: `${NS}:${item.id}`, count: 1 },
        unlock: [{ item: 'minecraft:iron_block' }],
      },
    });
  }
  out.push({
    'minecraft:recipe_shapeless': {
      description: { identifier: `${NS}:machine_manual` },
      tags: ['crafting_table'],
      ingredients: [{ item: 'minecraft:book' }, { item: 'minecraft:yellow_dye' }],
      result: { item: `${NS}:machine_manual`, count: 1 },
      unlock: [{ item: 'minecraft:book' }],
    },
  });
  out.push({
    'minecraft:recipe_shaped': {
      description: { identifier: `${NS}:crane_mast` },
      tags: ['crafting_table'],
      pattern: ['B B', 'BYB', 'B B'],
      key: { B: { item: 'minecraft:iron_bars' }, Y: { item: 'minecraft:yellow_dye' } },
      result: { item: `${NS}:crane_mast`, count: 8 },
      unlock: [{ item: 'minecraft:iron_bars' }],
    },
  });
  return out;
}
