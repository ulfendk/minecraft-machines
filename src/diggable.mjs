// Which blocks machines may dig, lift and never touch, shared by both editions.
// Ids are Java ids; JAVA_TO_BEDROCK renames the ones that differ on Bedrock.

const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];

/** Loose material: soil, sand, gravel, snow. */
export const EARTH = [
  'dirt', 'grass_block', 'coarse_dirt', 'rooted_dirt', 'podzol', 'mycelium', 'dirt_path', 'farmland', 'mud', 'clay',
  'gravel', 'sand', 'red_sand', 'soul_sand', 'soul_soil', 'moss_block', 'snow_block', 'snow',
];

/** Rock an excavator can break up. */
export const ROCK = [
  'stone', 'cobblestone', 'mossy_cobblestone', 'andesite', 'diorite', 'granite', 'tuff', 'calcite', 'deepslate',
  'cobbled_deepslate', 'sandstone', 'red_sandstone', 'netherrack', 'terracotta', ...COLOURS.map((c) => `${c}_terracotta`),
  'dripstone_block', 'basalt', 'smooth_basalt', 'blackstone', 'end_stone',
];

/** Plants that are simply flattened (no drop). */
export const PLANTS = [
  'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush', 'dandelion', 'poppy', 'blue_orchid', 'allium',
  'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'sweet_berry_bush',
];

export const DIG = [...EARTH, ...ROCK, ...PLANTS];

/** Extra building blocks that hooks and forks can lift (but buckets don't dig). */
export const LIFT = [
  ...WOODS.map((w) => `${w}_log`), ...WOODS.map((w) => `${w}_planks`), 'stone_bricks', 'bricks', 'hay_block', 'glass',
  'white_wool', 'iron_block', 'smooth_stone', 'polished_andesite', ...COLOURS.map((c) => `${c}_concrete`),
  'crane_mast',
];

/** Never dug, lifted or replaced, whatever a tag says. Block entities are excluded in code as well. */
export const NEVER = [
  'bedrock', 'obsidian', 'crying_obsidian', 'reinforced_deepslate', 'end_portal_frame', 'end_portal', 'end_gateway',
  'nether_portal', 'barrier', 'light', 'structure_block', 'structure_void', 'jigsaw', 'command_block',
  'chain_command_block', 'repeating_command_block', 'spawner', 'trial_spawner', 'vault', 'respawn_anchor',
  'ancient_debris', 'budding_amethyst', 'chest', 'trapped_chest', 'barrel', 'ender_chest', 'shulker_box', 'furnace',
  'blast_furnace', 'smoker', 'hopper', 'dropper', 'dispenser', 'beacon', 'conduit', 'lodestone',
];

/** What a dug block turns into in the load (null: nothing, it is just flattened). */
export const DROPS = {
  grass_block: 'dirt', mycelium: 'dirt', podzol: 'dirt', dirt_path: 'dirt', farmland: 'dirt', rooted_dirt: 'dirt',
  moss_block: 'dirt', stone: 'cobblestone', deepslate: 'cobbled_deepslate', snow: null,
  ...Object.fromEntries(PLANTS.map((p) => [p, null])),
};

/** Load kinds shown in buckets and beds: 0 soil, 1 rock, 2 sand. */
export function kindOf(item) {
  if (/sand|gravel|snow|concrete/.test(item)) return 2;
  if (ROCK.includes(item) || /cobble|stone|terracotta|basalt|netherrack/.test(item)) return 1;
  return 0;
}

/** Sand and gravel are what the mixer turns into concrete. */
export const MIXABLE = ['sand', 'red_sand', 'gravel'];

/** Java -> Bedrock block/item ids where they differ. */
export const JAVA_TO_BEDROCK = {
  dirt_path: 'grass_path',
  snow: 'snow_layer',
  snow_block: 'snow',
  rooted_dirt: 'dirt_with_roots',
  terracotta: 'hardened_clay',
  dead_bush: 'deadbush',
  bricks: 'brick_block',
  sweet_berry_bush: 'sweet_berry_bush',
  crane_mast: 'machines:crane_mast',
};

export const bedrockId = (id) => {
  const b = JAVA_TO_BEDROCK[id] ?? id;
  return b.includes(':') ? b : `minecraft:${b}`;
};
export const javaId = (id) => (id.includes(':') ? id : id === 'crane_mast' ? 'machines:crane_mast' : `minecraft:${id}`);
