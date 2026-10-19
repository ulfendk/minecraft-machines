import { cab, loadPiles, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Rear frame: engine, cab and the rear axle.
const rear = m.bone('rear', 'root', [0, 0, 0]);
rear.box([-9, 7, 0], [18, 5, 32], 'dark') // frame
  .box([-10, 12, 14], [20, 11, 17], 'paint') // engine housing
  .box([-9, 23, 16], [18, 2, 13], 'paint')
  .box([-10, 9, 31], [20, 12, 3], 'paint2') // counterweight
  .box([-10.5, 12, 31], [21, 2, 3.5], 'stripe')
  .box([-6, 25, 18], [4, 2, 6], 'dark') // grille
  .box([5, 25, 25], [2, 6, 2], 'dark') // exhaust
  .box([-9, 17, 33], [3, 2, 1], 'tail')
  .box([6, 17, 33], [3, 2, 1], 'tail')
  .box([-12, 12, 13], [24, 2, 2], 'paint') // fenders
  .box([-14, 15, 12], [5, 1, 13], 'paint')
  .box([9, 15, 12], [5, 1, 13], 'paint');
cab(rear, { x0: -8, y0: 12, z0: 1, w: 16, h: 18, d: 13, open: ['front', 'left', 'right', 'back'] });
const seatY = operatorSeat(rear, { x: 0, y: 12, z: 9 });
rear.box([-1, 15, 3], [2, 4, 1], 'dark') // steering column
  .box([-8, 30, 7], [2, 1, 2], 'beacon');
wheel(m, 'wheel_rl', 'rear', { x: 12, y: 8, z: 20, r: 8, w: 7 });
wheel(m, 'wheel_rr', 'rear', { x: -12, y: 8, z: 20, r: 8, w: 7 });

// Front frame: steers around the articulation joint.
const front = m.bone('front', 'root', [0, 9, 0]);
front.box([-7, 6, -24], [14, 8, 25], 'paint')
  .box([-3, 14, -10], [6, 8, 6], 'paint') // tower for the arms
  .box([-12, 15, -20], [5, 1, 12], 'paint') // fenders
  .box([7, 15, -20], [5, 1, 12], 'paint')
  .box([-6, 10, -25], [3, 2, 1], 'lamp')
  .box([3, 10, -25], [3, 2, 1], 'lamp');
wheel(m, 'wheel_fl', 'front', { x: 12, y: 8, z: -14, r: 8, w: 7 });
wheel(m, 'wheel_fr', 'front', { x: -12, y: 8, z: -14, r: 8, w: 7 });

// Lift arms (c0) and bucket (c1).
const arms = m.bone('arms', 'front', [0, 21, -8]);
arms.box([-10, 19, -33], [3, 4, 27], 'paint')
  .box([7, 19, -33], [3, 4, 27], 'paint')
  .box([-7, 19, -24], [14, 3, 3], 'paint')
  .box([-2, 22, -24], [4, 3, 16], 'metal'); // tilt cylinder
const bucket = m.bone('bucket', 'arms', [0, 21, -32]);
bucket.box([-16, 13, -34], [32, 13, 2], 'paint') // back
  .box([-16, 12, -43], [32, 2, 11], 'paint') // floor
  .box([-16, 14, -43], [1, 9, 9], 'paint') // sides
  .box([15, 14, -43], [1, 9, 9], 'paint')
  .box([-16, 11, -44], [32, 2, 2], 'metal'); // cutting edge
loadPiles(m, 'bucket', { x0: -14, y0: 14, z0: -41, w: 28, h: 6, d: 7 });

export default {
  id: 'wheel_loader',
  name: 'Wheel Loader',
  group: 'earthmover',
  info: 'An articulated wheel loader with a wide bucket. Lower the bucket and drive into a pile to scoop it up, then lift it and dump it into a dump truck.',
  scale: 1.5,
  hitbox: { width: 2.8, height: 3.0 },
  health: 90,
  mass: 25,
  camera: 9,
  seats: [{ at: [0, seatY, 9] }],
  drive: {
    type: 'articulated', speed: 0.22, accel: 0.04, brake: 0.08, turn: 3.5,
    wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((bone) => ({ bone, r: 8 })),
    steer: [{ bone: 'front', max: 30 }],
  },
  channels: [
    { id: 'lift', min: -24, max: 50, rate: 2, rest: -24 },
    { id: 'tilt', min: -45, max: 60, rate: 3, rest: 24 },
  ],
  drivers: [
    { bone: 'arms', prop: 'rotation', axis: 0, terms: [['c0', -1]] },
    { bone: 'bucket', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
  ],
  tool: { kind: 'bucket', tip: { bone: 'bucket', at: [0, 14, -40] }, reach: 1.5, capacity: 6, maxHardness: 1, scoop: true },
  recipe: { pattern: ['SGP', 'III', 'C C'], key: { S: 'iron_shovel', G: 'glass_pane', P: 'piston', I: 'iron_block', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '.......ccccc....',
      '.......cgggc....',
      '.......cgggc....',
      'bb.....cgggcyy..',
      'b.yyy..yyyyyyyy.',
      'b...yyyyyyyyyyy.',
      'bb....yyyyyyyy#.',
      'bbb..kkk.yy.kkk.',
      '....kkwkk..kkwkk',
      '....kwwwk..kwwwk',
      '....kkwkk..kkwkk',
      '.....kkk....kkk.',
      '................',
      '................',
    ],
    palette: { y: PALETTE.yellow, c: PALETTE.yellow, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', b: '#7d848a', '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow),
};
