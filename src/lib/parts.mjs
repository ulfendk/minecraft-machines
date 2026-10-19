// A small model builder plus the parts machines are made of: wheels, crawler tracks,
// cabs, lattice booms, hooks and load piles. Units are model pixels; the model faces -z.

const r = (n) => Math.round(n * 100) / 100;

export class Model {
  constructor() {
    this.bones = [];
  }

  /** Adds a bone; returns a handle with box() for adding cubes. */
  bone(name, parent, pivot, { rotation } = {}) {
    if (this.bones.some((b) => b.name === name)) throw new Error(`Duplicate bone ${name}`);
    const bone = { name, ...(parent ? { parent } : {}), pivot: pivot.map(r), cubes: [] };
    if (rotation) bone.rotation = rotation;
    this.bones.push(bone);
    return this.handle(bone);
  }

  get(name) {
    const bone = this.bones.find((b) => b.name === name);
    if (!bone) throw new Error(`No bone ${name}`);
    return this.handle(bone);
  }

  has(name) {
    return this.bones.some((b) => b.name === name);
  }

  handle(bone) {
    const h = {
      name: bone.name,
      /** origin and size in pixels; sizes are rounded to whole pixels (box UV needs them). */
      box(origin, size, mat, opts = {}) {
        const cube = { origin: origin.map(r), size: size.map((n) => Math.max(0, Math.round(n))), mat };
        if (opts.inflate) cube.inflate = opts.inflate;
        if (opts.rotation) {
          cube.rotation = opts.rotation;
          cube.pivot = (opts.pivot ?? origin.map((o, i) => o + size[i] / 2)).map(r);
        }
        bone.cubes.push(cube);
        return h;
      },
    };
    return h;
  }

  build() {
    return { bones: this.bones.map(({ cubes, ...b }) => (cubes.length ? { ...b, cubes } : b)) };
  }
}

/**
 * A wheel on its own bone (so it can spin and steer). (x, y, z) is the hub centre;
 * x > 0 puts the wheel's outer face at x + w/2.
 */
export function wheel(m, name, parent, { x, y, z, r: radius, w, hub = 'metal' }) {
  const b = m.bone(name, parent, [x, y, z]);
  b.box([x - w / 2, y - radius, z - radius], [w, 2 * radius, 2 * radius], 'tyre');
  const hubR = Math.max(1, Math.round(radius * 0.55));
  const out = x >= 0 ? x + w / 2 : x - w / 2 - 1;
  b.box([out, y - hubR, z - hubR], [1, 2 * hubR, 2 * hubR], hub);
  return b;
}

/**
 * A crawler track on the `side` (+1 / -1) of the machine: a belt with grousers that
 * appear to run (bones track_top_<s> and track_bot_<s>), a drive sprocket and an idler.
 * x is the track's centre line, w its width, z0..z1 its length, h its height.
 */
export function crawler(m, parent, { side, x, w, z0, z1, h, link = 3 }) {
  const s = side > 0 ? 'l' : 'r';
  const len = z1 - z0;
  const frame = m.bone(`track_${s}`, parent, [x, h / 2, (z0 + z1) / 2]);
  // Belt: upper and lower runs plus the rounded ends.
  frame.box([x - w / 2, h - 2, z0 + 2], [w, 2, len - 4], 'track');
  frame.box([x - w / 2, 1, z0 + 2], [w, 2, len - 4], 'track');
  frame.box([x - w / 2, 2, z0], [w, h - 4, 2], 'track');
  frame.box([x - w / 2, 2, z1 - 2], [w, h - 4, 2], 'track');
  // Track frame between the runs.
  frame.box([x - w / 2 + 1, 3, z0 + 2], [w - 2, h - 5, len - 4], 'dark');
  // Rollers along the bottom.
  for (let z = z0 + 6; z <= z1 - 6; z += 6) frame.box([x - w / 2 - (side > 0 ? -w + 1 : 0), 3, z - 1], [1, 2, 2], 'metal');
  // Grousers that slide along the runs (see the drive animation).
  const top = m.bone(`track_top_${s}`, `track_${s}`, [x, h, 0]);
  const bot = m.bone(`track_bot_${s}`, `track_${s}`, [x, 0, 0]);
  for (let z = z0 + 3; z <= z1 - 4; z += link) {
    top.box([x - w / 2, h, z], [w, 1, 1], 'track');
    bot.box([x - w / 2, 0, z], [w, 1, 1], 'track');
  }
  // Sprocket (rear) and idler (front) spin with the track.
  const sx = side > 0 ? x + w / 2 : x - w / 2 - 1;
  m.bone(`sprocket_${s}`, `track_${s}`, [sx, h / 2, z1 - 3]).box([sx, h / 2 - 2.5, z1 - 5.5], [1, 5, 5], 'metal');
  m.bone(`idler_${s}`, `track_${s}`, [sx, h / 2, z0 + 3]).box([sx, h / 2 - 2, z0 + 1], [1, 4, 4], 'dark');
  return { link, h };
}

/**
 * A cab with a roof, corner posts, glass on the open sides and a solid wall at the back.
 * open: which sides get glass ('front', 'left', 'right', 'back').
 */
export function cab(b, { x0, y0, z0, w, h, d, open = ['front', 'left', 'right'], wall = 'paint', roof = 'paint' }) {
  const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
  b.box([x0, y1 - 1, z0], [w, 1, d], roof); // roof
  b.box([x0 - 0.5, y1, z0 - 0.5], [w + 1, 1, d + 1], roof);
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) b.box([px, y0, pz], [1, h - 1, 1], 'frame');
  const glassOr = (side, glassBox, wallBox) => (open.includes(side) ? b.box(...glassBox, 'glass') : b.box(...wallBox, wall));
  glassOr('front', [[x0 + 1, y0 + 2, z0], [w - 2, h - 3, 1]], [[x0 + 1, y0, z0], [w - 2, h - 1, 1]]);
  glassOr('back', [[x0 + 1, y0 + 2, z1 - 1], [w - 2, h - 3, 1]], [[x0 + 1, y0, z1 - 1], [w - 2, h - 1, 1]]);
  glassOr('left', [[x1 - 1, y0 + 2, z0 + 1], [1, h - 3, d - 2]], [[x1 - 1, y0, z0 + 1], [1, h - 1, d - 2]]);
  glassOr('right', [[x0, y0 + 2, z0 + 1], [1, h - 3, d - 2]], [[x0, y0, z0 + 1], [1, h - 1, d - 2]]);
  // Lower panels under the glass.
  for (const side of open) {
    if (side === 'front') b.box([x0 + 1, y0, z0], [w - 2, 2, 1], wall);
    if (side === 'back') b.box([x0 + 1, y0, z1 - 1], [w - 2, 2, 1], wall);
    if (side === 'left') b.box([x1 - 1, y0, z0 + 1], [1, 2, d - 2], wall);
    if (side === 'right') b.box([x0, y0, z0 + 1], [1, 2, d - 2], wall);
  }
}

/** Operator seat with a backrest; (x, z) is the seat centre, y the floor. Returns the seat surface y. */
export function operatorSeat(b, { x, y, z }) {
  b.box([x - 2, y, z - 2], [4, 3, 4], 'seat');
  b.box([x - 2, y + 3, z + 1], [4, 5, 1], 'seat');
  return y + 3;
}

/**
 * A lattice boom along -z from (0, 0, 0) relative to `at`: four chords, rungs and
 * diagonal lacing. w x h is the cross-section.
 */
export function lattice(b, { at: [x, y, z], w, h, length, mat = 'paint', every = 8 }) {
  const x0 = x - w / 2, y0 = y - h / 2;
  // Chords in short pieces: long thin cubes waste a lot of texture space in box UV.
  for (const [cx, cy] of [[x0, y0], [x0 + w - 1, y0], [x0, y0 + h - 1], [x0 + w - 1, y0 + h - 1]]) {
    for (let d = 0; d < length; d += 32) b.box([cx, cy, z - Math.min(length, d + 32)], [1, 1, Math.min(32, length - d)], mat);
  }
  for (let d = every; d < length; d += every) {
    const zz = z - d;
    b.box([x0 + 1, y0, zz], [w - 2, 1, 1], mat);
    b.box([x0 + 1, y0 + h - 1, zz], [w - 2, 1, 1], mat);
    b.box([x0, y0 + 1, zz], [1, h - 2, 1], mat);
    b.box([x0 + w - 1, y0 + 1, zz], [1, h - 2, 1], mat);
    // Diagonal lacing on both sides, tilted 45 degrees in the y-z plane.
    const diag = Math.round(Math.hypot(every, h - 2) * 0.95);
    for (const sx of [x0, x0 + w - 1]) {
      b.box([sx, y0 + h / 2 - 0.5, zz + every / 2 - diag / 2], [1, 1, diag], mat, {
        rotation: [Math.round((Math.atan2(h - 2, every) * 180) / Math.PI), 0, 0],
        pivot: [sx + 0.5, y0 + h / 2, zz + every / 2],
      });
    }
  }
}

/**
 * The hoist: a bone that stays vertical (`hook_pivot`, counter-rotated against the boom),
 * a rope that stretches (`rope`, scaled on y) and the hook block (`hook`, moved down).
 * A crate under the hook shows a lifted block on Bedrock (bone `carry`).
 */
export function hoist(m, parent, [x, y, z], { hookMat = 'paint2' } = {}) {
  // The pulley block gives the pivot bone a cube (GeckoLib leaves empty bones unanimated).
  m.bone('hook_pivot', parent, [x, y, z]).box([x - 1.5, y - 1, z - 1.5], [3, 2, 3], 'dark');
  m.bone('rope', 'hook_pivot', [x, y, z]).box([x - 0.5, y - 16, z - 0.5], [1, 16, 1], 'dark');
  const hook = m.bone('hook', 'hook_pivot', [x, y, z]);
  hook.box([x - 2, y - 4, z - 2], [4, 3, 4], 'metal'); // block
  hook.box([x - 1.5, y - 6, z - 1.5], [3, 2, 3], hookMat); // weight
  hook.box([x - 0.5, y - 9, z - 0.5], [1, 3, 1], 'dark'); // hook shank
  hook.box([x - 0.5, y - 10, z - 2.5], [1, 1, 3], 'dark'); // hook bowl
  hook.box([x - 0.5, y - 9, z - 2.5], [1, 1, 1], 'dark');
  m.bone('carry', 'hook', [x, y - 10, z]).box([x - 4, y - 18, z - 4], [8, 8, 8], 'crate');
  return { tip: [x, y - 10, z] };
}

/**
 * Load piles inside a bucket or bed: one bone per bulk kind (dirt, stone, sand) whose
 * height follows the load. (x0, y0, z0) is the floor corner.
 */
export function loadPiles(m, parent, { x0, y0, z0, w, h, d }) {
  for (const [kind, mat] of [['dirt', 'soil'], ['stone', 'rock'], ['sand', 'sand']]) {
    const b = m.bone(`load_${kind}`, parent, [x0 + w / 2, y0, z0 + d / 2]);
    b.box([x0, y0, z0], [w, h, d], mat);
    b.box([x0 + 1, y0 + h, z0 + 1], [w - 2, 1, d - 2], mat);
  }
}
