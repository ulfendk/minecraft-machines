// Machine animations for both editions. Moving parts are described once as drivers:
//   { bone, prop: 'rotation'|'position'|'scale', axis, terms: [['c1', -1]], base }  (numeric, used for kinematics too)
//   { bone, prop, axis, expr: '...' }                                                  (visual only)
// Expressions use $-variables that each edition maps to its own Molang:
//   $c0..$c3 operating channels, $load (0..1), $kind (0 dirt, 1 stone, 2 sand), $steer (-1..1),
//   $dist (blocks driven), $time (seconds), $carry (0/1), $pour (0/1)

import { NS } from './constants.mjs';

const BEDROCK = {
  c0: 'v.c0', c1: 'v.c1', c2: 'v.c2', c3: 'v.c3', load: 'v.load', steer: 'v.steer',
  kind: `q.property('${NS}:kind')`, carry: `q.property('${NS}:carry')`, pour: `q.property('${NS}:pour')`,
  dist: 'q.modified_distance_moved', time: 'q.life_time',
};
const JAVA = {
  c0: 'variable.m_c0', c1: 'variable.m_c1', c2: 'variable.m_c2', c3: 'variable.m_c3', load: 'variable.m_load', steer: 'variable.m_steer',
  kind: 'variable.m_kind', carry: 'variable.m_carry', pour: 'variable.m_pour', dist: 'variable.m_dist', time: 'variable.m_time',
};

/** Variable names for one edition ('bedrock' | 'java' | 'preview'). */
export function variables(edition) {
  if (edition === 'java') return JAVA;
  if (edition === 'preview') return Object.fromEntries(Object.keys(BEDROCK).map((k) => [k, `$${k}`]));
  return BEDROCK;
}

const num = (n) => (Math.round(n * 10000) / 10000).toString();

function driverExpr(d, vars) {
  let e = d.expr ?? d.terms.map(([ch, k]) => (k === 1 ? `$${ch}` : `$${ch} * ${num(k)}`)).join(' + ');
  if (d.base && !d.expr) e = `${num(d.base)} + ${e}`;
  return e.replace(/\$([a-z0-9]+)/g, (m, name) => {
    if (!(name in vars)) throw new Error(`Unknown animation variable ${m}`);
    return vars[name];
  });
}

/** Drivers that make the machine roll: wheels spin, grousers run, sprockets turn. */
export function driveDrivers(spec) {
  const out = [];
  const d = spec.drive ?? {};
  const s = spec.scale;
  for (const w of d.wheels ?? []) {
    // Rolling without slipping: angle = distance / radius.
    out.push({ bone: w.bone, prop: 'rotation', axis: 0, expr: `$dist * ${num((16 / (w.r * s)) * (180 / Math.PI))}` });
  }
  for (const b of d.steer ?? []) out.push({ bone: b.bone, prop: 'rotation', axis: 1, expr: `$steer * ${num(b.max)}` });
  if (d.type === 'tracks') {
    const link = d.link ?? 3;
    const run = `math.mod($dist * ${num(16 / s)}, ${link})`;
    for (const side of ['l', 'r']) {
      out.push({ bone: `track_top_${side}`, prop: 'position', axis: 2, expr: `-${run}` });
      out.push({ bone: `track_bot_${side}`, prop: 'position', axis: 2, expr: run });
      out.push({ bone: `sprocket_${side}`, prop: 'rotation', axis: 0, expr: `$dist * ${num((16 / (2.5 * s)) * (180 / Math.PI))}` });
      out.push({ bone: `idler_${side}`, prop: 'rotation', axis: 0, expr: `$dist * ${num((16 / (2 * s)) * (180 / Math.PI))}` });
    }
  }
  return out;
}

/** Drivers for the load piles and the carried crate. */
export function loadDrivers(spec, boneNames) {
  const out = [];
  ['dirt', 'stone', 'sand'].forEach((kind, i) => {
    if (!boneNames.has(`load_${kind}`)) return;
    // The pile fills the bucket or bed from the bottom up.
    const on = `($kind == ${i} && $load > 0.01 ? 1 : 0)`;
    out.push({ bone: `load_${kind}`, prop: 'scale', axis: 0, expr: on });
    out.push({ bone: `load_${kind}`, prop: 'scale', axis: 1, expr: `${on} * math.clamp($load, 0.15, 1)` });
    out.push({ bone: `load_${kind}`, prop: 'scale', axis: 2, expr: on });
  });
  if (boneNames.has('carry')) out.push({ bone: 'carry', prop: 'scale', axis: -1, expr: '$carry' });
  return out;
}

/** All drivers of a machine: its own (channels and extras), plus driving and load visuals. */
export function allDrivers(spec) {
  const names = new Set(spec.model.bones.map((b) => b.name));
  return [...(spec.drivers ?? []), ...(spec.visuals ?? []), ...driveDrivers(spec), ...loadDrivers(spec, names)];
}

/** One looping animation that applies every driver. */
export function machineAnimation(spec, edition) {
  const vars = variables(edition);
  const bones = {};
  // Several drivers may target the same bone channel: sum them per axis.
  const sums = {};
  for (const d of allDrivers(spec)) {
    const key = `${d.bone}|${d.prop}`;
    const entry = (sums[key] ??= { bone: d.bone, prop: d.prop, axes: [[], [], []], uniform: [] });
    if (d.axis === -1) entry.uniform.push(driverExpr(d, vars));
    else entry.axes[d.axis].push(driverExpr(d, vars));
  }
  for (const { bone, prop, axes, uniform } of Object.values(sums)) {
    const b = (bones[bone] ??= {});
    if (prop === 'scale') {
      if (uniform.length) b.scale = [0, 1, 2].map(() => uniform.join(' * '));
      else b.scale = axes.map((list) => (list.length ? list.join(' * ') : 1));
    } else {
      b[prop] = axes.map((list) => (list.length ? list.map((e) => `(${e})`).join(' + ') : 0));
    }
  }
  return {
    format_version: '1.8.0',
    animations: { [`animation.${NS}.${spec.id}.move`]: { loop: true, bones } },
  };
}
