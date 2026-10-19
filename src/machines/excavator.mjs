import { cab, crawler, loadPiles, Model, operatorSeat } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Undercarriage
crawler(m, 'root', { side: 1, x: 12, w: 7, z0: -23, z1: 23, h: 8 });
crawler(m, 'root', { side: -1, x: -12, w: 7, z0: -23, z1: 23, h: 8 });
m.get('root')
  .box([-9, 3, -12], [18, 4, 24], 'dark')
  .box([-8, 7, -8], [16, 3, 16], 'dark');

// Upper structure, slews on the turntable.
const up = m.bone('upper', 'root', [0, 10, 0]);
up.box([-14, 10, -13], [28, 4, 31], 'paint') // deck
  .box([-14, 14, 3], [28, 9, 13], 'paint') // engine house
  .box([-14, 10, 16], [28, 12, 5], 'paint2') // counterweight
  .box([-14.5, 14, 16], [29, 3, 5], 'stripe')
  .box([-13, 23, 5], [10, 1, 9], 'dark') // engine grille
  .box([8, 23, 7], [2, 5, 2], 'dark') // exhaust
  .box([-14.5, 10, -13.5], [29, 1, 32], 'dark') // walkway edge
  .box([-12, 14, -12], [11, 2, 12], 'paint') // tool box / tank in front of the engine
  .box([-11, 16, -11], [9, 3, 10], 'paint');
cab(up, { x0: 1, y0: 14, z0: -13, w: 12, h: 17, d: 15, open: ['front', 'left', 'right'] });
const seatY = operatorSeat(up, { x: 7, y: 14, z: -5 });
up.box([3, 17, -12], [2, 3, 2], 'dark') // joysticks
  .box([9, 17, -12], [2, 3, 2], 'dark')
  .box([1, 31, -11], [2, 1, 2], 'beacon')
  .box([12, 22, -14], [1, 2, 1], 'lamp');

// Boom (raised by c1), stick (c2) and bucket (c3).
const boom = m.bone('boom', 'upper', [-4, 17, -12]);
boom.box([-7, 14, -16], [6, 7, 5], 'paint') // foot
  .box([-7, 14, -52], [6, 6, 37], 'paint')
  .box([-7.5, 13, -40], [7, 1, 18], 'stripe')
  .box([-6, 20, -44], [4, 2, 26], 'metal') // stick cylinder on top of the boom
  .box([-6, 11, -30], [4, 3, 14], 'metal'); // boom cylinder below
const stick = m.bone('stick', 'boom', [-4, 17, -50]);
stick.box([-6, -10, -52], [4, 30, 4], 'paint')
  .box([-5.5, 2, -48], [3, 14, 2], 'metal'); // bucket cylinder
const bucket = m.bone('bucket', 'stick', [-4, -9, -50]);
bucket.box([-8, -19, -52], [8, 10, 2], 'paint') // back of the bucket
  .box([-8, -21, -52], [8, 2, 9], 'paint') // floor
  .box([-8, -19, -50], [1, 6, 7], 'paint') // sides
  .box([-1, -19, -50], [1, 6, 7], 'paint')
  .box([-8, -22, -44], [2, 2, 2], 'metal') // teeth
  .box([-5, -22, -44], [2, 2, 2], 'metal')
  .box([-2, -22, -44], [2, 2, 2], 'metal');
loadPiles(m, 'bucket', { x0: -7, y0: -19, z0: -50, w: 6, h: 5, d: 6 });

const materials = commonMaterials(PALETTE.yellow);

export default {
  id: 'excavator',
  name: 'Excavator',
  group: 'earthmover',
  info: 'A tracked excavator with a cab that turns all the way round. Swing the boom, stick and bucket to dig real blocks, then dump them on a pile or into a dump truck.',
  scale: 1.5,
  hitbox: { width: 3, height: 2.8 },
  health: 100,
  mass: 30,
  camera: 9,
  seats: [{ at: [7, seatY, -5], bone: 'upper' }],
  drive: { type: 'tracks', speed: 0.13, accel: 0.03, brake: 0.06, turn: 2.5, link: 3 },
  channels: [
    { id: 'slew', min: -180, max: 180, wrap: true, rate: 3, rest: 0 },
    { id: 'boom', min: -25, max: 50, rate: 1.6, rest: 10 },
    { id: 'stick', min: -45, max: 60, rate: 2, rest: 30 },
    { id: 'bucket', min: -50, max: 100, rate: 3, rest: 20 },
  ],
  drivers: [
    { bone: 'upper', prop: 'rotation', axis: 1, terms: [['c0', 1]] },
    { bone: 'boom', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
    { bone: 'stick', prop: 'rotation', axis: 0, terms: [['c2', 1]] },
    { bone: 'bucket', prop: 'rotation', axis: 0, terms: [['c3', 1]] },
  ],
  tool: { kind: 'bucket', tip: { bone: 'bucket', at: [-4, -20, -45] }, reach: 1.3, capacity: 4, maxHardness: 3 },
  recipe: { pattern: ['  P', 'IGS', 'TTT'], key: { P: 'piston', I: 'iron_block', G: 'glass_pane', S: 'iron_shovel', T: 'rail' } },
  icon: {
    rows: [
      '................',
      '..........##....',
      '.........#yy#...',
      '........#yy##y..',
      '.......#yy#..y..',
      '..ccc.#yy#...y#.',
      '..cgg#yy#....#ww',
      '..cggyy#......w.',
      '.yyyyyyyy#......',
      '.yyyyyyyyy#.....',
      '.##########.....',
      'kkkkkkkkkkkk....',
      'k.k.k.k.k.kk....',
      'kkkkkkkkkkkk....',
      '................',
      '................',
    ],
    palette: { y: PALETTE.yellow, '#': '#3a3a3a', c: PALETTE.yellow, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a' },
  },
  model: m.build(),
  materials,
};
