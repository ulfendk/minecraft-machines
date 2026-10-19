// The crane mast: a see-through lattice block that tower cranes stand on.
import { PNG } from 'pngjs';
import { hex } from './lib/texture.mjs';
import { NS } from './lib/constants.mjs';

/** Yellow steel lattice: a frame round the edge and an X brace, transparent in between. */
function mastTexture() {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(0);
  const yellow = hex('#f2b705'), shadow = hex('#b98a03'), bolt = hex('#5a4a1a');
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const edge = x < 2 || y < 2 || x > 13 || y > 13;
      const brace = Math.abs(x - y) <= 0.5 || Math.abs(x + y - 15) <= 0.5;
      if (edge) png.data.set(x === 0 || y === 15 ? shadow : yellow, (y * 16 + x) * 4);
      else if (brace) png.data.set(shadow, (y * 16 + x) * 4);
    }
  for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) png.data.set(bolt, (y * 16 + x) * 4);
  return PNG.sync.write(png);
}

const box = (origin, size) => ({
  origin, size,
  uv: Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map((f) => [f, { uv: [0, 0], uv_size: [16, 16] }])),
});

export const blocks = [
  {
    id: 'crane_mast',
    name: 'Crane Mast',
    sound: 'metal',
    texture: mastTexture(),
    geometry: {
      format_version: '1.12.0',
      'minecraft:geometry': [{
        description: { identifier: `geometry.${NS}.crane_mast`, texture_width: 16, texture_height: 16 },
        bones: [{ name: 'mast', pivot: [0, 0, 0], cubes: [box([-8, 0, -8], [16, 16, 16])] }],
      }],
    },
    definition: {
      format_version: '1.21.90',
      'minecraft:block': {
        description: { identifier: `${NS}:crane_mast`, menu_category: { category: 'construction' } },
        components: {
          'minecraft:geometry': `geometry.${NS}.crane_mast`,
          'minecraft:material_instances': { '*': { texture: `${NS}_crane_mast`, render_method: 'alpha_test', ambient_occlusion: false } },
          'minecraft:light_dampening': 0,
          'minecraft:destructible_by_mining': { seconds_to_destroy: 1.5 },
          'minecraft:destructible_by_explosion': { explosion_resistance: 6 },
          'minecraft:map_color': '#f2b705',
          'minecraft:display_name': `tile.${NS}:crane_mast.name`,
          // Right-clicking the mast takes you up into the tower crane's cab (scripts/towercrane.js).
          [`${NS}:mast`]: {},
        },
      },
    },
  },
];
