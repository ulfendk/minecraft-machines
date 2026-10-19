import { cab, crawler, hoist, lattice, Model, operatorSeat } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const S = 2.0;
const BOOM = 120; // pixels: 15 blocks

const m = new Model();
m.bone('root', null, [0, 0, 0]);
crawler(m, 'root', { side: 1, x: 13, w: 8, z0: -22, z1: 22, h: 8 });
crawler(m, 'root', { side: -1, x: -13, w: 8, z0: -22, z1: 22, h: 8 });
m.get('root')
  .box([-9, 3, -14], [18, 4, 28], 'dark')
  .box([-8, 7, -8], [16, 3, 16], 'dark');

const up = m.bone('upper', 'root', [0, 10, 0]);
up.box([-12, 10, -12], [24, 4, 32], 'paint') // deck
  .box([-12, 14, 2], [24, 12, 16], 'paint') // machine house
  .box([-12.5, 18, 2], [25, 2, 16.5], 'stripe')
  .box([-12, 10, 20], [24, 16, 6], 'paint') // counterweight
  .box([-12.5, 14, 20], [25, 3, 6.5], 'stripe')
  .box([-3, 26, 6], [2, 4, 2], 'dark') // exhaust
  // A-frame gantry that holds the boom's pendant lines
  .box([-6, 26, 4], [1, 16, 1], 'metal', { rotation: [-20, 0, 0] })
  .box([5, 26, 4], [1, 16, 1], 'metal', { rotation: [-20, 0, 0] })
  .box([-6, 40, 0], [12, 1, 1], 'metal');
cab(up, { x0: 3, y0: 14, z0: -12, w: 9, h: 13, d: 11, open: ['front', 'left', 'right'] });
const seatY = operatorSeat(up, { x: 7.5, y: 14, z: -5 });
up.box([10, 27, -6], [2, 1, 2], 'beacon');

// Lattice boom, raised by c1 (degrees above horizontal).
const boom = m.bone('boom', 'upper', [-2, 16, -12]);
boom.box([-6, 13, -16], [8, 6, 6], 'paint'); // foot
lattice(boom, { at: [-2, 16, -14], w: 8, h: 8, length: BOOM - 4, every: 10 });
boom.box([-4, 12, -14 - BOOM], [4, 8, 6], 'metal'); // head with sheaves
const { tip } = hoist(m, 'boom', [-2, 12, -11 - BOOM]);

export default {
  id: 'crawler_crane',
  name: 'Crawler Crane',
  group: 'crane',
  info: 'A heavy crane on crawler tracks with a tall lattice boom. Raise the boom, lower the hook onto a block, an animal or another machine, and lift it.',
  scale: S,
  hitbox: { width: 3.6, height: 3.4 },
  bounds: { width: 40, height: 40 },
  health: 140,
  mass: 60,
  camera: 14,
  seats: [{ at: [7.5, seatY, -5], bone: 'upper' }],
  drive: { type: 'tracks', speed: 0.09, accel: 0.03, brake: 0.06, turn: 1.8, link: 3 },
  channels: [
    { id: 'slew', min: -180, max: 180, wrap: true, rate: 1.5, rest: 0 },
    { id: 'luff', min: 10, max: 78, rate: 0.6, rest: 55 },
    { id: 'hoist', min: 1, max: 40, rate: 0.35, rest: 6 },
  ],
  drivers: [
    { bone: 'upper', prop: 'rotation', axis: 1, terms: [['c0', 1]] },
    { bone: 'boom', prop: 'rotation', axis: 0, terms: [['c1', -1]] },
    { bone: 'hook_pivot', prop: 'rotation', axis: 0, terms: [['c1', 1]] },
    { bone: 'hook', prop: 'position', axis: 1, terms: [['c2', -16 / S]] },
  ],
  visuals: [{ bone: 'rope', prop: 'scale', axis: 1, expr: `$c2 * ${1 / S}` }],
  tool: { kind: 'hook', tip: { bone: 'hook', at: tip }, lift: 60, rope: 2 },
  recipe: { pattern: ['  B', 'BGI', 'TTT'], key: { B: 'iron_bars', G: 'glass_pane', I: 'iron_block', T: 'rail' } },
  icon: {
    rows: [
      '.............rr.',
      '............r.r.',
      '...........r.r..',
      '..........r.r..k',
      '.........r.r...k',
      '........r.r....k',
      '.......r.r.....k',
      '......r.r......y',
      '.....r.r........',
      '..rrrrrr........',
      '..rrrrrrr#......',
      '..rrrrrrrr#.....',
      '.kkkkkkkkkkk....',
      'kwkwkwkwkwkwk...',
      '.kkkkkkkkkkk....',
      '................',
    ],
    palette: { r: PALETTE.red, k: '#2a2a2a', w: '#9a9a9a', y: PALETTE.yellow, '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.red),
};
