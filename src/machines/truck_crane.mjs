import { cab, hoist, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const S = 1.6;

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Carrier: driver's cab at the front, four axles, outriggers.
const carrier = m.get('root');
carrier.box([-10, 6, -40], [20, 7, 80], 'dark')
  .box([-12, 13, -40], [24, 3, 80], 'paint')
  .box([-12.5, 13.5, -40], [25, 1, 80.5], 'stripe')
  .box([-13, 16, -24], [26, 1, 16], 'paint') // fenders
  .box([-13, 16, 14], [26, 1, 22], 'paint')
  .box([-15, 6, -6], [30, 3, 3], 'paint2') // outrigger beams
  .box([-15, 6, 32], [30, 3, 3], 'paint2')
  .box([-11, 10, -45], [22, 4, 2], 'metal') // bumper
  .box([-10, 13, 40], [3, 2, 1], 'tail')
  .box([7, 13, 40], [3, 2, 1], 'tail');
cab(carrier, { x0: -11, y0: 16, z0: -44, w: 13, h: 14, d: 12, open: ['front', 'left', 'right'] });
carrier.box([2, 16, -44], [9, 10, 12], 'paint') // engine cover beside the cab
  .box([-10, 13, -45], [4, 2, 1], 'lamp')
  .box([6, 13, -45], [4, 2, 1], 'lamp');
const driverY = operatorSeat(carrier, { x: -5, y: 16, z: -37 });
for (const [name, z] of [['wheel_1', -30], ['wheel_2', -16], ['wheel_3', 18], ['wheel_4', 32]]) {
  wheel(m, `${name}l`, 'root', { x: 13, y: 7, z, r: 7, w: 6 });
  wheel(m, `${name}r`, 'root', { x: -13, y: 7, z, r: 7, w: 6 });
}

// Superstructure: slews (c0) with its own operator's cab.
const up = m.bone('upper', 'root', [0, 16, 12]);
up.box([-11, 16, 0], [22, 4, 26], 'paint')
  .box([-11, 20, 12], [22, 10, 14], 'paint') // engine house
  .box([-11, 16, 26], [22, 14, 5], 'ballast') // counterweight
  .box([-11.5, 24, 12], [23, 2, 19.5], 'stripe');
cab(up, { x0: 3, y0: 20, z0: -2, w: 8, h: 12, d: 11, open: ['front', 'left', 'right'] });
const seatY = operatorSeat(up, { x: 7, y: 20, z: 5 });

// Telescopic boom: raised by c1, extended by c2 (blocks).
const boom = m.bone('boom', 'upper', [-4, 30, 22]);
boom.box([-8, 26, -42], [8, 8, 66], 'paint')
  .box([-8.5, 26, -42], [9, 2, 66], 'paint2')
  .box([-6, 20, 6], [4, 8, 6], 'metal'); // luffing cylinder
const tele = m.bone('tele', 'boom', [-4, 30, -42]);
tele.box([-7, 27, -50], [6, 6, 48], 'paint')
  .box([-6.5, 26, -52], [5, 8, 3], 'metal');
const { tip } = hoist(m, 'tele', [-4, 27, -51]);

export default {
  id: 'truck_crane',
  name: 'Mobile Crane',
  group: 'crane',
  info: 'A mobile crane on wheels with a telescopic boom that slides out. Drive it to the job, raise and extend the boom and lift.',
  scale: S,
  hitbox: { width: 3.0, height: 3.4 },
  bounds: { width: 32, height: 32 },
  health: 120,
  mass: 45,
  camera: 13,
  seats: [{ at: [7, seatY, 5], bone: 'upper' }, { at: [-5, driverY, -37] }],
  drive: {
    type: 'wheels', speed: 0.3, accel: 0.025, brake: 0.06, turn: 2.5,
    wheels: ['1l', '1r', '2l', '2r', '3l', '3r', '4l', '4r'].map((w) => ({ bone: `wheel_${w}`, r: 7 })),
    steer: ['wheel_1l', 'wheel_1r', 'wheel_2l', 'wheel_2r'].map((bone) => ({ bone, max: 25 })),
  },
  channels: [
    { id: 'slew', min: -180, max: 180, wrap: true, rate: 1.5, rest: 0 },
    { id: 'luff', min: 0, max: 75, rate: 0.8, rest: 0 },
    { id: 'telescope', min: 0, max: 4.5, rate: 0.08, rest: 0 },
    { id: 'hoist', min: 0.5, max: 30, rate: 0.35, rest: 1 },
  ],
  drivers: [
    { bone: 'upper', prop: 'rotation', axis: 1, terms: [['c0', 1]] },
    { bone: 'boom', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
    { bone: 'tele', prop: 'position', axis: 2, terms: [['c2', -16 / S]] },
    { bone: 'hook_pivot', prop: 'rotation', axis: 0, terms: [['c1', 1]] },
    { bone: 'hook', prop: 'position', axis: 1, terms: [['c3', -16 / S]] },
  ],
  visuals: [{ bone: 'rope', prop: 'scale', axis: 1, expr: `$c3 * ${1 / S}` }],
  tool: { kind: 'hook', tip: { bone: 'hook', at: tip }, lift: 40, rope: 3 },
  recipe: { pattern: ['  B', 'BGI', 'C C'], key: { B: 'iron_bars', G: 'glass_pane', I: 'iron_block', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '...........oo...',
      '.........ooo.k..',
      '.......ooo...k..',
      '.....ooo.....k..',
      '...ooo.......y..',
      '..oo............',
      '.ooooo..........',
      'cgooooooooooooo.',
      'cgooooooooooooo.',
      'oooooooooooooooo',
      '.kk.kk.....kk.kk',
      'kwwkwwk...kwwkww',
      '.kk.kk.....kk.kk',
      '................',
      '................',
    ],
    palette: { o: PALETTE.orange, c: PALETTE.orange, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', y: PALETTE.yellow },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.orange),
};
