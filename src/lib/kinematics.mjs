// Forward kinematics shared by the build, the preview renderer, the Bedrock scripts
// (copied into the behavior pack as scripts/kinematics.js) and the tests. The Java
// mod implements the same maths in dk.ulfen.machines.machine.Kinematics.
//
// Bone transforms follow tools/render.mjs (and GeckoLib): in geometry space a bone
// is rotated around its pivot by Rz(-z) * Ry(y) * Rx(-x) (degrees), after being
// moved by its animated position. Geometry faces -z; positions are in pixels.

const DEG = Math.PI / 180;

export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) o[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return o;
}

export const translate = ([x, y, z]) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
function rx(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; }
function ry(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; }
function rz(t) { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

export const rotate = ([x, y, z]) => mul(rz(-z * DEG), mul(ry(y * DEG), rx(-x * DEG)));

export const apply = (m, [x, y, z]) => [
  m[0] * x + m[1] * y + m[2] * z + m[3],
  m[4] * x + m[5] * y + m[6] * z + m[7],
  m[8] * x + m[9] * y + m[10] * z + m[11],
];

/**
 * Evaluate the numeric drivers for a set of channel values.
 * A driver: { bone, prop: 'rotation'|'position', axis, terms: [[channel, factor]], base }.
 * Returns { [bone]: { rotation: [x,y,z], position: [x,y,z] } } (offsets added to the rest pose).
 */
export function pose(drivers, values) {
  const out = {};
  for (const d of drivers) {
    if (d.prop !== 'rotation' && d.prop !== 'position') continue;
    if (!d.terms.every(([ch]) => ch in values)) continue;
    const b = (out[d.bone] ??= { rotation: [0, 0, 0], position: [0, 0, 0] });
    b[d.prop][d.axis] += (d.base ?? 0) + d.terms.reduce((s, [ch, k]) => s + values[ch] * k, 0);
  }
  return out;
}

/**
 * World matrices (geometry space, pixels) of the bones on the chain to `target`.
 * chain: [{ name, parent, pivot, rotation }] ordered root -> target (from chainTo()).
 */
export function chainMatrix(chain, posed) {
  let m = identity();
  for (const bone of chain) {
    const p = posed[bone.name] ?? { rotation: [0, 0, 0], position: [0, 0, 0] };
    const rot = (bone.rotation ?? [0, 0, 0]).map((v, i) => v + p.rotation[i]);
    const pivot = bone.pivot ?? [0, 0, 0];
    const local = mul(translate(p.position), mul(translate(pivot), mul(rotate(rot), translate(pivot.map((v) => -v)))));
    m = mul(m, local);
  }
  return m;
}

/** The bones from the root to `name`, in order. */
export function chainTo(bones, name) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const out = [];
  for (let b = byName.get(name); b; b = b.parent ? byName.get(b.parent) : null) {
    out.unshift({ name: b.name, parent: b.parent ?? null, pivot: b.pivot ?? [0, 0, 0], rotation: b.rotation ?? [0, 0, 0] });
  }
  if (!out.length) throw new Error(`No bone "${name}"`);
  return out;
}

/** A point on a bone (pixels, bone-local = geometry space at rest) in geometry space for the given channel values. */
export function pointOn(chain, drivers, values, offset) {
  return apply(chainMatrix(chain, pose(drivers, values)), offset);
}

/**
 * Geometry pixels -> entity-local blocks (+z forward, +y up, +x to the machine's left).
 * The model faces -z; x keeps its sign (checked in game: MachineClientGameTest.calibrate).
 */
export const toLocal = ([x, y, z], scale) => [(x / 16) * scale, (y / 16) * scale, (-z / 16) * scale];

/** Entity-local blocks -> world offset for an entity with yaw `yawDeg` (Minecraft yaw: 0 = +z). */
export function toWorld([x, y, z], yawDeg) {
  const a = yawDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [x * c - z * s, y, z * c + x * s];
}
