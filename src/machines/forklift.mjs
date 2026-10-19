import { Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const S = 1.0;

const m = new Model();
m.bone('root', null, [0, 0, 0]);
const body = m.get('root');
body.box([-9, 4, -10], [18, 10, 24], 'paint')
  .box([-10, 4, 14], [20, 14, 6], 'paint2') // counterweight
  .box([-10.5, 14, 14], [21, 2, 6.5], 'stripe')
  .box([-8, 14, 4], [16, 5, 10], 'paint') // engine cover / seat base
  .box([-8, 14, -9], [16, 2, 8], 'dark'); // footwell
for (const [x, z] of [[-8, -8], [7, -8], [-8, 12], [7, 12]]) body.box([x, 14, z], [1, 18, 1], 'frame');
body.box([-8, 32, -8], [16, 1, 21], 'frame')
  .box([-7, 33, 10], [2, 1, 2], 'beacon')
  .box([-1, 16, -6], [2, 6, 1], 'dark');
const seatY = operatorSeat(body, { x: 0, y: 16, z: 7 });
wheel(m, 'wheel_fl', 'root', { x: 10, y: 5, z: -5, r: 5, w: 4 });
wheel(m, 'wheel_fr', 'root', { x: -10, y: 5, z: -5, r: 5, w: 4 });
wheel(m, 'wheel_rl', 'root', { x: 9, y: 4, z: 13, r: 4, w: 3 });
wheel(m, 'wheel_rr', 'root', { x: -9, y: 4, z: 13, r: 4, w: 3 });

// Mast tilts (c1); the carriage with the forks rides up it (c0, blocks).
const mast = m.bone('mast', 'root', [0, 4, -12]);
mast.box([-8, 2, -14], [2, 44, 2], 'dark')
  .box([6, 2, -14], [2, 44, 2], 'dark')
  .box([-6, 44, -14], [12, 2, 2], 'dark')
  .box([-1, 6, -13], [2, 34, 1], 'chrome');
const carriage = m.bone('carriage', 'mast', [0, 4, -16]);
carriage.box([-8, 3, -17], [16, 10, 2], 'metal')
  .box([-6, 2, -31], [3, 1, 15], 'metal')
  .box([3, 2, -31], [3, 1, 15], 'metal')
  .box([-6, 2, -17], [3, 8, 1], 'metal')
  .box([3, 2, -17], [3, 8, 1], 'metal');
m.bone('carry', 'carriage', [0, 3, -24]).box([-7, 3, -31], [14, 14, 14], 'crate');

export default {
  id: 'forklift',
  name: 'Forklift',
  group: 'extra',
  info: 'A forklift for moving one block at a time: crates, logs, bricks and other building materials. Slide the forks under a block, lift it and set it down somewhere else.',
  scale: S,
  hitbox: { width: 1.6, height: 2.2 },
  health: 40,
  mass: 8,
  camera: 6,
  seats: [{ at: [0, seatY, 7] }],
  drive: {
    type: 'wheels', speed: 0.22, accel: 0.06, brake: 0.1, turn: 5,
    wheels: [{ bone: 'wheel_fl', r: 5 }, { bone: 'wheel_fr', r: 5 }, { bone: 'wheel_rl', r: 4 }, { bone: 'wheel_rr', r: 4 }],
    steer: [{ bone: 'wheel_rl', max: -35 }, { bone: 'wheel_rr', max: -35 }],
  },
  channels: [
    { id: 'forks', min: 0, max: 2.5, rate: 0.06, rest: 0 },
    { id: 'mast', min: -5, max: 10, rate: 0.5, rest: 0 },
  ],
  drivers: [
    { bone: 'carriage', prop: 'position', axis: 1, terms: [['c0', 16 / S]] },
    { bone: 'mast', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
  ],
  tool: { kind: 'forks', tip: { bone: 'carriage', at: [0, 3, -24] } },
  recipe: { pattern: ['B  ', 'BII', 'C C'], key: { B: 'iron_bars', I: 'iron_block', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '.k..............',
      '.k...kkkkkkk....',
      '.k...k.....k....',
      '.k...k.....k....',
      '.k...k.....k....',
      '.k...k..#..k....',
      '.k...yyyyyyyyy..',
      '.k...yyyyyyyy##.',
      '.k..yyyyyyyyy##.',
      '.k..yyyyyyyyy##.',
      '.mmmyyyyyyyyy##.',
      '.k..kkk....kk...',
      '...kkwkk..kkwk..',
      '....kkk....kk...',
      '................',
    ],
    palette: { y: PALETTE.yellow, k: '#202224', w: '#9a9a9a', m: '#7d848a', '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow, { mudTo: 0 }),
};
