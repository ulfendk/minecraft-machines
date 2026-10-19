import { cab, Model, operatorSeat, wheel } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const S = 1.4;

const m = new Model();
m.bone('root', null, [0, 0, 0]);
const body = m.get('root');
body.box([-10, 6, -24], [20, 8, 48], 'dark')
  .box([-11, 14, -6], [9, 10, 24], 'paint') // engine on the right
  .box([-11, 24, -4], [9, 1, 20], 'dark')
  .box([-12, 16, -24], [24, 1, 12], 'paint') // fenders
  .box([-12, 16, 12], [24, 1, 12], 'paint')
  .box([-10, 8, 24], [20, 8, 3], 'paint2')
  .box([-9, 10, 27], [3, 2, 1], 'tail')
  .box([6, 10, 27], [3, 2, 1], 'tail');
cab(body, { x0: 2, y0: 14, z0: -14, w: 10, h: 17, d: 20, open: ['front', 'left', 'right', 'back'] });
const seatY = operatorSeat(body, { x: 7, y: 14, z: -2 });
body.box([10, 31, 2], [2, 1, 2], 'beacon');
for (const [name, x, z] of [['wheel_fl', 13, -16], ['wheel_fr', -13, -16], ['wheel_rl', 13, 16], ['wheel_rr', -13, 16]]) {
  wheel(m, name, 'root', { x, y: 8, z, r: 8, w: 6 });
}

// Boom pivots at the back (c0), slides out (c1, blocks); the fork head tilts (c2) and stays level.
const boom = m.bone('boom', 'root', [-4, 22, 20]);
boom.box([-7, 18, -26], [7, 7, 49], 'paint')
  .box([-7.5, 18, -26], [8, 2, 49], 'paint2')
  .box([-6, 12, 0], [5, 7, 6], 'metal');
const ext = m.bone('boom_ext', 'boom', [-4, 22, -26]);
ext.box([-6, 19, -42], [5, 5, 40], 'paint')
  .box([-6.5, 18, -44], [6, 7, 3], 'metal');
const head = m.bone('fork_head', 'boom_ext', [-4, 21, -44]);
head.box([-12, 12, -46], [16, 14, 2], 'metal')
  .box([-10, 11, -60], [3, 1, 15], 'metal')
  .box([0, 11, -60], [3, 1, 15], 'metal');
m.bone('carry', 'fork_head', [-4, 12, -53]).box([-11, 12, -60], [14, 14, 14], 'crate');

export default {
  id: 'telehandler',
  name: 'Telehandler',
  group: 'extra',
  info: 'A telehandler with a long telescopic boom and forks. It lifts blocks high up and far out, so you can put building materials on a roof.',
  scale: S,
  hitbox: { width: 2.6, height: 3.0 },
  health: 70,
  mass: 15,
  camera: 9,
  seats: [{ at: [7, seatY, -2] }],
  drive: {
    type: 'wheels', speed: 0.26, accel: 0.04, brake: 0.08, turn: 3.5,
    wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((bone) => ({ bone, r: 8 })),
    steer: [{ bone: 'wheel_fl', max: 30 }, { bone: 'wheel_fr', max: 30 }],
  },
  channels: [
    { id: 'luff', min: -8, max: 60, rate: 1, rest: 0 },
    { id: 'extend', min: 0, max: 4, rate: 0.06, rest: 0 },
    { id: 'fork_tilt', min: -30, max: 30, rate: 1.5, rest: 0 },
  ],
  drivers: [
    { bone: 'boom', prop: 'rotation', axis: 0, terms: [['c0', -1]] },
    { bone: 'boom_ext', prop: 'position', axis: 2, terms: [['c1', -16 / S]] },
    { bone: 'fork_head', prop: 'rotation', axis: 0, terms: [['c0', 1], ['c2', -1]] },
  ],
  tool: { kind: 'forks', tip: { bone: 'fork_head', at: [-4, 12, -53] } },
  recipe: { pattern: ['  P', 'PIG', 'C C'], key: { P: 'piston', I: 'iron_block', G: 'glass_pane', C: 'coal_block' } },
  icon: {
    rows: [
      '................',
      '................',
      '..........mm....',
      '........yyyym...',
      '......yyyy..m...',
      '....yyyy....m...',
      '..yyyy..ccc.mmmm',
      'yyyy....cgc.....',
      '..yyyyyycgcyy...',
      '..yyyyyyyyyyy...',
      '.kkk.....kkk....',
      'kkwkk...kkwkk...',
      'kwwwk...kwwwk...',
      '.kkk.....kkk....',
      '................',
      '................',
    ],
    palette: { y: PALETTE.green, c: PALETTE.green, g: '#a8d4e6', k: '#2a2a2a', w: '#9a9a9a', m: '#7d848a' },
  },
  model: m.build(),
  materials: commonMaterials(PALETTE.green),
};
