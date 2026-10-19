import { cab, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, drumStripes, PALETTE } from '../lib/materials.mjs';

const S = 1.5;

const m = new Model();
m.bone('root', null, [0, 0, 0]);
const body = m.get('root');
body.box([-9, 6, -36], [18, 6, 72], 'dark')
  .box([-12, 12, -24], [24, 2, 58], 'paint2')
  .box([-12, 14, -40], [24, 6, 14], 'paint') // engine
  .box([-11, 10, -41], [22, 4, 1], 'metal')
  .box([-10, 15, -41], [3, 2, 1], 'lamp')
  .box([7, 15, -41], [3, 2, 1], 'lamp')
  .box([-13, 17, -36], [26, 1, 12], 'paint')
  .box([-9, 12, 36], [3, 2, 1], 'tail')
  .box([6, 12, 36], [3, 2, 1], 'tail')
  // Drum supports and the loading hopper at the back.
  .box([-7, 14, -18], [14, 14, 3], 'metal')
  .box([-6, 14, 24], [12, 16, 3], 'metal')
  .box([-5, 30, 26], [10, 4, 8], 'paint2');
cab(body, { x0: -11, y0: 20, z0: -38, w: 22, h: 14, d: 12, open: ['front', 'left', 'right'] });
const seatY = operatorSeat(body, { x: 4, y: 20, z: -31 });
body.box([-11, 34, -32], [2, 1, 2], 'beacon');
for (const [name, x, z] of [['wheel_fl', 13, -30], ['wheel_fr', -13, -30], ['wheel_ml', 13, 12], ['wheel_mr', -13, 12], ['wheel_rl', 13, 26], ['wheel_rr', -13, 26]]) {
  wheel(m, name, 'root', { x, y: 7, z, r: 7, w: 6 });
}
// The drum is tilted up towards the back and turns while it holds concrete.
m.bone('drum_mount', 'root', [0, 26, 4], { rotation: [-8, 0, 0] });
m.bone('drum', 'drum_mount', [0, 26, 4])
  .box([-10, 16, -14], [20, 20, 34], 'drum')
  .box([-8, 18, -18], [16, 16, 4], 'drum')
  .box([-6, 20, 20], [12, 12, 6], 'drum')
  .box([-4, 22, 26], [8, 8, 3], 'metal');
// Chute at the back: swings (c0) and tilts down (c1).
const chute = m.bone('chute', 'root', [0, 24, 36]);
chute.box([-3, 21, 36], [6, 1, 14], 'metal')
  .box([-3, 22, 36], [1, 2, 14], 'metal')
  .box([2, 22, 36], [1, 2, 14], 'metal');

export default {
  id: 'mixer_truck',
  name: 'Concrete Mixer Truck',
  group: 'extra',
  info: 'A concrete mixer truck. Fill the drum with sand or gravel, then pour concrete from the chute. Right-click it with a dye to choose the colour.',
  scale: S,
  hitbox: { width: 2.8, height: 3.4 },
  health: 80,
  mass: 25,
  camera: 10,
  seats: [{ at: [4, seatY, -31] }, { at: [-4, seatY, -31] }],
  drive: {
    type: 'wheels', speed: 0.32, accel: 0.03, brake: 0.07, turn: 3,
    wheels: ['wheel_fl', 'wheel_fr', 'wheel_ml', 'wheel_mr', 'wheel_rl', 'wheel_rr'].map((bone) => ({ bone, r: 7 })),
    steer: [{ bone: 'wheel_fl', max: 25 }, { bone: 'wheel_fr', max: 25 }],
  },
  channels: [
    { id: 'chute', min: -90, max: 90, rate: 2, rest: 0 },
    { id: 'chute_tilt', min: 0, max: 40, rate: 1.5, rest: 20 },
  ],
  drivers: [
    { bone: 'chute', prop: 'rotation', axis: 1, terms: [['c0', 1]] },
    { bone: 'chute', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
  ],
  visuals: [{ bone: 'drum', prop: 'rotation', axis: 2, expr: '$time * ($load > 0.01 ? 120 : 15)' }],
  tool: { kind: 'drum', tip: { bone: 'chute', at: [0, 21, 50] }, capacity: 12 },
  recipe: { pattern: [' H ', 'IGI', 'C C'], key: { H: 'cauldron', I: 'iron_block', G: 'glass_pane', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '.......wwwwww...',
      '.....wwrrwwwwrw.',
      '....wwwwrrwwwwrw',
      'ccc.wwwwwwrrwwww',
      'cgg..wwwwwwwrw#.',
      'cgg..#.......#..',
      'yyyyyyyyyyyyyyy.',
      'yyyyy#########..',
      '.kkk.....kkk.kkk',
      'kkwkk...kkwkkkwk',
      'kwwwk...kwwwkwww',
      '.kkk.....kkk.kkk',
      '................',
      '................',
    ],
    palette: { w: PALETTE.white, r: PALETTE.red, c: PALETTE.yellow, g: '#a8d4e6', y: PALETTE.yellow, k: '#2a2a2a', '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: { ...commonMaterials(PALETTE.yellow), drum: drumStripes(PALETTE.white, PALETTE.red) },
};
