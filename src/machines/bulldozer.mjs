import { cab, crawler, Model, operatorSeat } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const m = new Model();
m.bone('root', null, [0, 0, 0]);
crawler(m, 'root', { side: 1, x: 13, w: 8, z0: -22, z1: 22, h: 9 });
crawler(m, 'root', { side: -1, x: -13, w: 8, z0: -22, z1: 22, h: 9 });
const body = m.get('root');
body.box([-9, 4, -20], [18, 6, 40], 'dark')
  .box([-9, 10, -21], [18, 9, 24], 'paint') // engine hood
  .box([-8, 19, -20], [16, 1, 22], 'paint')
  .box([-7, 11, -22], [14, 7, 1], 'dark') // radiator grille
  .box([-11, 10, 3], [22, 9, 18], 'paint') // rear body
  .box([4, 19, -16], [2, 7, 2], 'dark') // exhaust
  .box([-17, 9, -22], [34, 1, 44], 'paint') // track guards
  .box([-17.5, 9.5, -22.5], [35, 1, 2], 'stripe');
cab(body, { x0: -9, y0: 19, z0: 3, w: 18, h: 16, d: 14, open: ['front', 'left', 'right', 'back'] });
const seatY = operatorSeat(body, { x: 0, y: 19, z: 11 });
body.box([-9, 35, 9], [2, 1, 2], 'beacon');

// Blade: up/down (c0, in blocks) and tilt (c1).
const blade = m.bone('blade', 'root', [0, 8, -27]);
blade.box([-15, 4, -27], [3, 4, 22], 'paint') // push arms
  .box([12, 4, -27], [3, 4, 22], 'paint')
  .box([-3, 13, -24], [6, 4, 8], 'metal') // lift cylinder
  .box([-20, 0, -31], [40, 15, 3], 'paint') // blade
  .box([-20, 15, -30], [40, 2, 2], 'paint')
  .box([-20, -1, -32], [40, 2, 2], 'metal') // cutting edge
  .box([-21, 0, -31], [1, 16, 5], 'paint')
  .box([20, 0, -31], [1, 16, 5], 'paint');
// Ripper at the back (c2).
const ripper = m.bone('ripper', 'root', [0, 12, 21]);
ripper.box([-8, 9, 21], [16, 4, 4], 'paint')
  .box([-1.5, -2, 24], [3, 13, 3], 'metal')
  .box([-1.5, -3, 23], [3, 2, 2], 'dark');

export default {
  id: 'bulldozer',
  name: 'Bulldozer',
  group: 'earthmover',
  info: 'A heavy crawler bulldozer. Set the blade and drive: it cuts away hills and fills holes, leaving the ground flat. Lower the blade below the tracks to dig down a level.',
  scale: 1.6,
  hitbox: { width: 3.4, height: 3.2 },
  health: 120,
  mass: 30,
  camera: 9,
  seats: [{ at: [0, seatY, 11] }],
  drive: { type: 'tracks', speed: 0.14, accel: 0.04, brake: 0.08, turn: 2.5, link: 3 },
  channels: [
    { id: 'blade', min: -1, max: 2, rate: 0.08, rest: 0 },
    { id: 'blade_tilt', min: -8, max: 8, rate: 0.5, rest: 0 },
    { id: 'ripper', min: 0, max: 35, rate: 1.5, rest: 0 },
  ],
  drivers: [
    { bone: 'blade', prop: 'position', axis: 1, terms: [['c0', 16 / 1.6]] },
    { bone: 'blade', prop: 'rotation', axis: 2, terms: [['c1', 1]] },
    { bone: 'ripper', prop: 'rotation', axis: 0, terms: [['c2', 1]] },
  ],
  tool: { kind: 'blade', tip: { bone: 'blade', at: [0, 0, -32] }, capacity: 8, maxHardness: 1.5, strip: { ahead: 2.9, width: 4 } },
  recipe: { pattern: ['G  ', 'BII', 'TTT'], key: { G: 'glass_pane', B: 'anvil', I: 'iron_block', T: 'rail' } },
  icon: {
    rows: [
      '................',
      '................',
      '........ccccc...',
      '........cgggc...',
      '........cgggc...',
      '.b....#.cgggc...',
      '.b..yyyyyyyyyy..',
      '.b..yyyyyyyyyy..',
      '.byyyyyyyyyyyyy.',
      '.b.kkkkkkkkkkkk.',
      '.bkwkwkwkwkwkwkk',
      '.bkkkkkkkkkkkkkk',
      '..kkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
    palette: { y: PALETTE.yellow, c: PALETTE.yellow, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', b: PALETTE.yellow, '#': '#3a3a3a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow),
};
