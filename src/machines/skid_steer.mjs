import { loadPiles, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
const body = m.get('root');
body.box([-10, 4, -10], [20, 8, 26], 'paint') // lower body
  .box([-9, 12, 8], [18, 10, 9], 'paint') // engine
  .box([-9, 22, 9], [18, 1, 7], 'dark')
  .box([-10, 4, 16], [20, 6, 2], 'paint2')
  .box([-8, 23, 12], [2, 4, 2], 'dark'); // exhaust
// Operator cage
for (const [x, z] of [[-8, -8], [7, -8], [-8, 7], [7, 7]]) body.box([x, 12, z], [1, 18, 1], 'frame');
body.box([-8, 30, -8], [16, 1, 16], 'paint')
  .box([-7, 13, 7], [14, 16, 1], 'frame')
  .box([-7, 13, -8], [14, 14, 1], 'glass')
  .box([-8, 12, -7], [16, 1, 14], 'dark');
const seatY = operatorSeat(body, { x: 0, y: 12, z: 2 });
for (const [name, x, z] of [['wheel_fl', 13, -5], ['wheel_fr', -13, -5], ['wheel_rl', 13, 10], ['wheel_rr', -13, 10]]) {
  wheel(m, name, 'root', { x, y: 6, z, r: 6, w: 5 });
}
// Lift arms pivot behind the cage (c0); the bucket tilts at their front (c1).
const arms = m.bone('arms', 'root', [0, 26, 14]);
arms.box([10, 24, -16], [2, 4, 32], 'paint')
  .box([-12, 24, -16], [2, 4, 32], 'paint')
  .box([10, 8, -18], [2, 20, 2], 'paint')
  .box([-12, 8, -18], [2, 20, 2], 'paint')
  .box([-11, 10, -18], [22, 2, 2], 'paint');
const bucket = m.bone('bucket', 'arms', [0, 9, -19]);
bucket.box([-14, 6, -21], [28, 11, 2], 'paint')
  .box([-14, 5, -29], [28, 2, 9], 'paint')
  .box([-14, 7, -29], [1, 7, 8], 'paint')
  .box([13, 7, -29], [1, 7, 8], 'paint')
  .box([-14, 4, -30], [28, 2, 2], 'metal');
loadPiles(m, 'bucket', { x0: -12, y0: 7, z0: -27, w: 24, h: 5, d: 6 });

export default {
  id: 'skid_steer',
  name: 'Skid Steer',
  group: 'earthmover',
  info: 'A small, nimble skid steer loader that turns on the spot. Great for tidying up a building site and light enough for any crane to lift.',
  scale: 1.0,
  hitbox: { width: 1.8, height: 2.0 },
  health: 50,
  mass: 6,
  camera: 6,
  seats: [{ at: [0, seatY, 2] }],
  drive: {
    type: 'skid', speed: 0.2, accel: 0.06, brake: 0.1, turn: 5,
    wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((bone) => ({ bone, r: 6 })),
  },
  channels: [
    { id: 'lift', min: 0, max: 70, rate: 2.5, rest: 0 },
    { id: 'tilt', min: -45, max: 40, rate: 3, rest: 0 },
  ],
  drivers: [
    { bone: 'arms', prop: 'rotation', axis: 0, terms: [['c0', -1]] },
    { bone: 'bucket', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
  ],
  tool: { kind: 'bucket', tip: { bone: 'bucket', at: [0, 7, -27] }, reach: 1.0, capacity: 2, maxHardness: 1, scoop: true },
  recipe: { pattern: [' G ', 'SII', 'C C'], key: { G: 'glass_pane', S: 'iron_shovel', I: 'iron_block', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '................',
      '.....ccccc......',
      '.....c...c.yyy..',
      '.....c.g.cyy....',
      '..yyyyyyyyy.....',
      '..y..c...cy.....',
      'yyy..yyyyyyyy...',
      'b.y..yyyyyyyy...',
      'bby..yyyyyyyy...',
      'bbb.kkk...kkk...',
      '...kkwkk.kkwkk..',
      '...kwwwk.kwwwk..',
      '...kkwkk.kkwkk..',
      '....kkk...kkk...',
    ],
    palette: { y: PALETTE.yellow, c: '#202224', g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', b: '#7d848a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow, { mudTo: 5 }),
};
