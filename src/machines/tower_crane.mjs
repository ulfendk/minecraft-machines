import { cab, hoist, lattice, Model, operatorSeat } from '../lib/parts.mjs';
import { commonMaterials, PALETTE } from '../lib/materials.mjs';

const S = 2.0;
const JIB = 200; // pixels: 25 blocks
const COUNTER = 64;

const m = new Model();
m.bone('root', null, [0, 0, 0]);
// Turntable on top of the mast blocks.
m.get('root').box([-8, 0, -8], [16, 3, 16], 'dark');

const slew = m.bone('slew', 'root', [0, 3, 0]);
slew.box([-8, 3, -8], [16, 3, 16], 'paint');
// Tower head with the peak that holds the tie bars.
for (const [x, z] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) slew.box([x, 6, z], [1, 30, 1], 'paint');
slew.box([-4, 36, -4], [8, 2, 8], 'paint');
// Jib (forward) and counter-jib (back).
lattice(slew, { at: [0, 10, -4], w: 6, h: 6, length: JIB - 4, every: 10 });
lattice(slew, { at: [0, 10, 4 + COUNTER], w: 6, h: 6, length: COUNTER, every: 10 });
// Tie bars from the peak down to the jib and counter-jib.
const tie = (len, angle, z) => slew.box([-0.5, 37, z - len], [1, 1, len], 'metal', { rotation: [angle, 0, 0], pivot: [0, 37.5, z] });
tie(Math.round(Math.hypot(24, 110)), Math.round((Math.atan2(24, 110) * 180) / Math.PI), 0);
slew.box([-0.5, 37, 0], [1, 1, Math.round(Math.hypot(24, 56))], 'metal', { rotation: [-Math.round((Math.atan2(24, 56) * 180) / Math.PI), 0, 0], pivot: [0, 37.5, 0] });
// Counterweights and the hoist winch on the counter-jib.
slew.box([-6, 0, 50], [12, 12, 8], 'paint2')
  .box([-6, 0, 58], [12, 12, 8], 'paint2')
  .box([-4, 13, 20], [8, 6, 8], 'dark');
// Operator's cab on the side of the tower head.
cab(slew, { x0: 4, y0: 4, z0: -12, w: 9, h: 12, d: 10, open: ['front', 'left', 'right'] });
const seatY = operatorSeat(slew, { x: 8.5, y: 4, z: -6 });
slew.box([-1, 38, -1], [2, 2, 2], 'beacon');

// Trolley runs along the jib (c1, blocks out from the tower).
const trolley = m.bone('trolley', 'slew', [0, 7, -16]);
trolley.box([-4, 5, -19], [8, 3, 6], 'metal')
  .box([-3, 3, -18], [6, 2, 4], 'dark');
const { tip } = hoist(m, 'trolley', [0, 4, -16]);

export default {
  id: 'tower_crane',
  name: 'Tower Crane',
  group: 'tower',
  info: 'A tall tower crane on a mast of crane mast blocks. Swing the jib, run the trolley out and hoist the load up. Build it with the Tower Crane Kit, then right-click the mast to ride up into the cab.',
  scale: S,
  hitbox: { width: 1.2, height: 2.0 },
  bounds: { width: 64, height: 64 },
  health: 150,
  mass: 100,
  camera: 18,
  seats: [{ at: [8.5, seatY, -6], bone: 'slew' }],
  drive: { type: 'none' },
  channels: [
    { id: 'slew', min: -180, max: 180, wrap: true, rate: 1.2, rest: 0 },
    { id: 'trolley', min: 0, max: 22, rate: 0.15, rest: 2 },
    { id: 'hoist', min: 1, max: 48, rate: 0.4, rest: 4 },
  ],
  drivers: [
    { bone: 'slew', prop: 'rotation', axis: 1, terms: [['c0', 1]] },
    { bone: 'trolley', prop: 'position', axis: 2, terms: [['c1', -16 / S]] },
    { bone: 'hook', prop: 'position', axis: 1, terms: [['c2', -16 / S]] },
  ],
  visuals: [{ bone: 'rope', prop: 'scale', axis: 1, expr: `$c2 * ${1 / S}` }],
  tool: { kind: 'hook', tip: { bone: 'hook', at: tip }, lift: 30, rope: 2 },
  recipe: { pattern: ['BBB', ' B ', 'IGI'], key: { B: 'iron_bars', I: 'iron_block', G: 'glass_pane' } },
  icon: { rows: [], palette: {} },
  model: m.build(),
  materials: commonMaterials(PALETTE.yellow, { mudTo: 0 }),
};
