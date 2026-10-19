import { Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Rear: engine, operator's platform with a canopy, drive wheels.
const rear = m.get('root');
rear.box([-10, 7, -4], [20, 13, 26], 'paint')
  .box([-9, 20, 10], [18, 2, 11], 'dark')
  .box([-10, 7, 22], [20, 8, 2], 'paint2')
  .box([4, 20, 14], [2, 5, 2], 'dark')
  .box([-9, 11, 24], [3, 2, 1], 'tail')
  .box([6, 11, 24], [3, 2, 1], 'tail');
for (const [x, z] of [[-9, -2], [8, -2], [-9, 9], [8, 9]]) rear.box([x, 20, z], [1, 16, 1], 'frame');
rear.box([-10, 36, -3], [20, 1, 14], 'paint')
  .box([-9, 36.5, 2], [2, 1, 2], 'beacon');
const seatY = operatorSeat(rear, { x: 0, y: 20, z: 4 });
rear.box([-1, 23, -1], [2, 4, 1], 'dark');
wheel(m, 'wheel_rl', 'root', { x: 12, y: 8, z: 14, r: 8, w: 6 });
wheel(m, 'wheel_rr', 'root', { x: -12, y: 8, z: 14, r: 8, w: 6 });

// Front: the steel drum in its yoke, steering around the joint.
const front = m.bone('front', 'root', [0, 10, -6]);
front.box([-15, 10, -30], [2, 12, 20], 'paint')
  .box([13, 10, -30], [2, 12, 20], 'paint')
  .box([-15, 20, -30], [30, 3, 20], 'paint')
  .box([-15.5, 21, -30.5], [31, 1, 21], 'stripe')
  .box([-4, 12, -12], [8, 8, 8], 'dark');
m.bone('drum', 'front', [0, 10, -20])
  .box([-13, 1, -29], [26, 18, 18], 'metal')
  .box([-12, 0, -28], [24, 20, 16], 'metal')
  .box([-14, 7, -23], [1, 6, 6], 'dark')
  .box([13, 7, -23], [1, 6, 6], 'dark');

export default {
  id: 'road_roller',
  name: 'Road Roller',
  group: 'extra',
  info: 'A road roller. Drive it over the ground to press grass and dirt into paths and smooth out small bumps.',
  scale: 1.5,
  hitbox: { width: 2.8, height: 3.4 },
  health: 70,
  mass: 15,
  camera: 8,
  seats: [{ at: [0, seatY, 4] }],
  drive: {
    type: 'articulated', speed: 0.18, accel: 0.03, brake: 0.06, turn: 3,
    wheels: [{ bone: 'drum', r: 10 }, { bone: 'wheel_rl', r: 8 }, { bone: 'wheel_rr', r: 8 }],
    steer: [{ bone: 'front', max: 30 }],
  },
  channels: [],
  drivers: [],
  tool: { kind: 'roller', capacity: 4, strip: { ahead: 1.9, width: 3 } },
  recipe: { pattern: ['G  ', 'III', 'SCS'], key: { G: 'glass_pane', I: 'iron_block', S: 'smooth_stone', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '.........kkkkkk.',
      '.........k....k.',
      '.........k....k.',
      '.........k....k.',
      '..yyyyyy.k....k.',
      '..y....yyyyyyyy.',
      '.wwwwww.yyyyyyy.',
      'wwwwwwww.yyyyyy.',
      'wwwwwwww..kkk...',
      'wwwwwwww.kkwkk..',
      'wwwwwwww.kwwwk..',
      '.wwwwww..kkwkk..',
      '..........kkk...',
      '................',
    ],
    palette: { y: PALETTE.orange, k: '#202224', w: '#9aa1a6' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.orange, { mudTo: 4 }),
};
