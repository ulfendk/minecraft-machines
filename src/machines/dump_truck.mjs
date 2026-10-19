import { cab, loadPiles, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Front tractor unit: steers around the articulation joint.
const front = m.bone('front', 'root', [0, 8, -8]);
front.box([-9, 6, -36], [18, 6, 30], 'dark')
  .box([-11, 9, -40], [22, 9, 13], 'paint') // engine hood
  .box([-10, 18, -39], [20, 1, 11], 'paint')
  .box([-8, 10, -41], [16, 6, 1], 'dark') // grille
  .box([-11, 13, -41], [3, 2, 1], 'lamp')
  .box([8, 13, -41], [3, 2, 1], 'lamp')
  .box([-13, 17, -34], [26, 1, 14], 'paint'); // fenders
cab(front, { x0: -8, y0: 18, z0: -27, w: 16, h: 16, d: 12, open: ['front', 'left', 'right', 'back'] });
const seatY = operatorSeat(front, { x: 0, y: 18, z: -19 });
front.box([-1, 21, -25], [2, 4, 1], 'dark');
wheel(m, 'wheel_fl', 'front', { x: 13, y: 8, z: -28, r: 8, w: 7 });
wheel(m, 'wheel_fr', 'front', { x: -13, y: 8, z: -28, r: 8, w: 7 });

// Rear unit: two axles and the tipping bed.
const rear = m.get('root');
rear.box([-8, 6, -8], [16, 6, 44], 'dark')
  .box([-13, 16, 4], [26, 1, 32], 'paint')
  .box([-9, 13, 36], [3, 2, 1], 'tail')
  .box([6, 13, 36], [3, 2, 1], 'tail');
for (const [name, x, z] of [['wheel_ml', 13, 12], ['wheel_mr', -13, 12], ['wheel_rl', 13, 28], ['wheel_rr', -13, 28]]) {
  wheel(m, name, 'root', { x, y: 8, z, r: 8, w: 7 });
}
const bed = m.bone('bed', 'root', [0, 17, 36]);
bed.box([-13, 17, -8], [26, 2, 44], 'paint') // floor
  .box([-13, 19, -8], [1, 12, 44], 'paint') // sides
  .box([12, 19, -8], [1, 12, 44], 'paint')
  .box([-13.5, 27, -8], [2, 2, 44], 'paint2', { inflate: 0.05 }) // rims
  .box([11.5, 27, -8], [2, 2, 44], 'paint2', { inflate: 0.05 })
  .box([-13, 19, -10], [26, 16, 2], 'paint') // headboard
  .box([-13, 33, -26], [26, 2, 16], 'paint') // canopy over the cab
  .box([-12, 17, 34], [24, 3, 3], 'stripe');
loadPiles(m, 'bed', { x0: -11, y0: 19, z0: -6, w: 22, h: 9, d: 40 });

export default {
  id: 'dump_truck',
  name: 'Dump Truck',
  group: 'earthmover',
  info: 'An articulated dump truck with a huge bed. Let the excavator or wheel loader fill it, drive the load away and tip the bed to pour it out behind you.',
  scale: 1.6,
  hitbox: { width: 3.0, height: 3.4 },
  health: 100,
  mass: 35,
  camera: 10,
  seats: [{ at: [0, seatY, -19], bone: 'front' }, { at: [5, seatY, -22], bone: 'front' }],
  drive: {
    type: 'articulated', speed: 0.3, accel: 0.03, brake: 0.07, turn: 3,
    wheels: ['wheel_fl', 'wheel_fr', 'wheel_ml', 'wheel_mr', 'wheel_rl', 'wheel_rr'].map((bone) => ({ bone, r: 8 })),
    steer: [{ bone: 'front', max: 30 }],
  },
  channels: [{ id: 'bed', min: 0, max: 55, rate: 1.5, rest: 0 }],
  drivers: [{ bone: 'bed', prop: 'rotation', axis: 0, terms: [['c0', -1]] }],
  tool: { kind: 'bed', capacity: 24, pour: [0, 4, 44] },
  recipe: { pattern: ['I I', 'IGI', 'C C'], key: { I: 'iron_block', G: 'glass_pane', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '................',
      '....yyyyyyyyyy..',
      '....ybbbbbbbby..',
      '.cccybbbbbbbby..',
      '.cggyyyyyyyyyy..',
      '.cggc###########',
      'yyyyy#########..',
      'yyyyyy.........',
      '.kkk.....kkk.kkk',
      'kkwkk...kkwkkkwk',
      'kwwwk...kwwwkwww',
      'kkwkk...kkwkkkwk',
      '.kkk.....kkk.kkk',
      '................',
    ],
    palette: { y: PALETTE.yellow, c: PALETTE.yellow, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', b: '#6b4c2f', '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow),
};
