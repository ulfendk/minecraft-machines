// What each tool does, the same rules as MachineTools on Java: buckets dig and dump,
// blades level, beds tip, hooks lift, forks carry, the mixer pours and the roller packs.
import { TERRAIN } from './data.js';
import { mem, getLoad, setLoad, takeOne, total, getString, setString } from './state.js';
import { around, block, breakBlock, canDig, canLift, dropItem, dropOf, isAir, mayEdit, place, pour } from './terrain.js';
import { world } from '@minecraft/server';
import { add, forward, modelPoint, NS, operatorOf, specOf, tip } from './util.js';

const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const PATHABLE = new Set(['minecraft:grass_block', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:podzol', 'minecraft:mycelium', 'minecraft:dirt_with_roots']);
const UNLIFTABLE = new Set(['minecraft:wither', 'minecraft:ender_dragon', 'minecraft:warden', 'minecraft:elder_guardian', 'minecraft:player']);

function tell(m, key, ...args) {
  const op = operatorOf(m);
  if (op) op.onScreenDisplay.setActionBar({ rawtext: [{ translate: `${NS}.${key}`, with: args.map(String) }] });
}

function updateKind(m, load) {
  const counts = Object.entries(load).sort((a, b) => b[1] - a[1]);
  const kind = counts.length ? TERRAIN.KINDS[counts[0][0]] ?? 0 : 0;
  try { m.setProperty(`${NS}:kind`, kind); } catch {}
}

function saveLoad(m, spec, load) {
  setLoad(m, load, spec.tool.capacity);
  updateKind(m, load);
}

/** Forward movement since the last tick (blocks; negative when reversing). */
function forwardMotion(m, s) {
  const f = forward(m);
  const d = { x: m.location.x - s.last.x, z: m.location.z - s.last.z };
  return d.x * f.x + d.z * f.z;
}

function setMode(m, on) {
  try { m.setProperty(`${NS}:pour`, !!on); } catch {}
  mem(m).toggle = !!on;
}
const modeOn = (m) => !!mem(m).toggle || (() => { try { return m.getProperty(`${NS}:pour`); } catch { return false; } })();

// ------------------------------------------------------------ action button

export function action(m) {
  const spec = specOf(m);
  switch (spec.tool.kind) {
    case 'bucket': return bucketAction(m, spec);
    case 'blade':
      setMode(m, !modeOn(m));
      return m.dimension.playSound('random.click', m.location);
    case 'bed': {
      const c = spec.channels[0];
      const now = m.getProperty(`${NS}:c0`);
      return m.setProperty(`${NS}:c0`, now > 20 ? c.min : c.max);
    }
    case 'hook': return hookAction(m, spec);
    case 'forks': return forksAction(m, spec);
    case 'drum':
      setMode(m, !modeOn(m) && total(getLoad(m)) > 0);
      return m.dimension.playSound('random.click', m.location);
    default:
      return m.dimension.playSound('note.didgeridoo', m.location, { pitch: 0.8 });
  }
}

// ------------------------------------------------------------ bucket

function dig(m, spec, at, minY = -Infinity) {
  const load = getLoad(m);
  const op = operatorOf(m);
  let dug = 0;
  for (const p of around(at, spec.tool.reach)) {
    if (total(load) >= spec.tool.capacity) break;
    if (p.y < minY) continue;
    const b = block(m.dimension, p);
    if (!canDig(b)) continue;
    const drop = dropOf(b);
    if (!breakBlock(b, op)) continue;
    if (drop) load[drop] = (load[drop] ?? 0) + 1;
    dug++;
  }
  if (dug) saveLoad(m, spec, load);
  return dug;
}

function bucketAction(m, spec) {
  const at = tip(m, spec);
  const load = getLoad(m);
  if (total(load) === 0) {
    if (!mayEdit(operatorOf(m))) return tell(m, 'protected');
    if (!dig(m, spec, at)) tell(m, 'nothing');
    return;
  }
  const receiver = receiverAt(m, at);
  if (receiver) {
    const rspec = specOf(receiver);
    const rload = getLoad(receiver);
    let moved = 0;
    for (const id of Object.keys(load)) {
      if (rspec.tool.kind === 'drum' && !TERRAIN.MIXABLE.includes(id)) continue;
      const n = Math.min(load[id], rspec.tool.capacity - total(rload));
      if (n <= 0) break;
      rload[id] = (rload[id] ?? 0) + n;
      load[id] -= n;
      if (load[id] <= 0) delete load[id];
      moved += n;
    }
    if (!moved && rspec.tool.kind === 'drum') tell(m, 'mixer.only');
    saveLoad(receiver, rspec, rload);
    m.dimension.playSound('dig.gravel', at, { pitch: 0.7 });
  } else {
    const op = operatorOf(m);
    while (total(load) > 0) {
      const id = takeOne(load);
      if (!pour(m.dimension, at, id, op)) {
        load[id] = (load[id] ?? 0) + 1;
        tell(m, 'no_room');
        break;
      }
    }
  }
  saveLoad(m, spec, load);
}

function receiverAt(m, at) {
  let near;
  try {
    near = m.dimension.getEntities({ families: ['machine'], location: at, maxDistance: 5 });
  } catch {
    return undefined;
  }
  for (const e of near) {
    const s = specOf(e);
    if (e.id === m.id || !s || (s.tool.kind !== 'bed' && s.tool.kind !== 'drum')) continue;
    const half = s.width / 2 + 0.6;
    if (Math.abs(at.x - e.location.x) <= half && Math.abs(at.z - e.location.z) <= half && at.y >= e.location.y + 0.5 && at.y <= e.location.y + s.height + 3) {
      if (total(getLoad(e)) < s.tool.capacity) return e;
    }
  }
  return undefined;
}

// ------------------------------------------------------------ hook and forks

function hookAction(m, spec) {
  const h = tip(m, spec);
  if (getString(m, 'carried_entity') || getString(m, 'carried_block')) return release(m, spec, h);
  let near = [];
  try {
    near = m.dimension.getEntities({ location: { x: h.x, y: h.y - 1.5, z: h.z }, maxDistance: 2.5 });
  } catch {}
  for (const e of near) {
    if (e.id === m.id || UNLIFTABLE.has(e.typeId) || e.typeId === 'minecraft:item') continue;
    const s = specOf(e);
    if (s) {
      if (s.drive.type === 'none' || operatorOf(e)) continue;
      if (s.mass > spec.tool.lift) {
        tell(m, 'too_heavy');
        m.dimension.playSound('random.anvil_land', h, { volume: 0.5, pitch: 1.4 });
        return;
      }
    }
    setString(m, 'carried_entity', e.id);
    setCarry(m, false);
    m.dimension.playSound('block.chain.place', h);
    return;
  }
  for (const dy of [0.4, 1.4]) {
    if (pickUp(m, block(m.dimension, { x: h.x, y: h.y - dy, z: h.z }))) return;
  }
}

function pickUp(m, b) {
  if (!canLift(b) || !mayEdit(operatorOf(m))) return false;
  setString(m, 'carried_block', b.typeId);
  try {
    b.setType('minecraft:air');
  } catch {
    return false;
  }
  setCarry(m, true);
  m.dimension.playSound('block.chain.place', b.location);
  return true;
}

function setCarry(m, on) {
  try { m.setProperty(`${NS}:carry`, on); } catch {}
}

function release(m, spec, at) {
  const id = getString(m, 'carried_entity');
  if (id) {
    const e = findEntity(m, id);
    if (e) {
      try { e.addEffect('slow_falling', 60, { showParticles: false }); } catch {}
    }
    setString(m, 'carried_entity', undefined);
  }
  const blockId = getString(m, 'carried_block');
  if (blockId) {
    let p = { x: Math.floor(at.x), y: Math.floor(at.y - 0.5), z: Math.floor(at.z) };
    for (let i = 0; i < 24 && isAir(block(m.dimension, add(p, { x: 0, y: -1, z: 0 }))); i++) p = add(p, { x: 0, y: -1, z: 0 });
    if (!place(block(m.dimension, p), blockId, operatorOf(m)) && !place(block(m.dimension, add(p, { x: 0, y: 1, z: 0 })), blockId, operatorOf(m))) {
      return tell(m, 'no_room');
    }
    setString(m, 'carried_block', undefined);
  }
  setCarry(m, false);
  m.dimension.playSound('block.chain.break', at);
}

function forksAction(m, spec) {
  const at = tip(m, spec);
  const carried = getString(m, 'carried_block');
  if (carried) {
    if (place(block(m.dimension, { x: at.x, y: at.y + 0.5, z: at.z }), carried, operatorOf(m))) {
      setString(m, 'carried_block', undefined);
      setCarry(m, false);
    } else {
      tell(m, 'no_room');
    }
    return;
  }
  if (!pickUp(m, block(m.dimension, { x: at.x, y: at.y + 0.3, z: at.z }))) pickUp(m, block(m.dimension, { x: at.x, y: at.y - 0.3, z: at.z }));
}

function findEntity(m, id) {
  try {
    return m.dimension.getEntities({ location: m.location, maxDistance: 96 }).find((e) => e.id === id);
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------ ticking tools

function hookTick(m, spec, s) {
  const rope = spec.tool.rope;
  const carriedId = getString(m, 'carried_entity');
  const carried = carriedId ? (s.carried?.id === carriedId && s.carried.isValid ? s.carried : (s.carried = findEntity(m, carriedId))) : undefined;
  if (carriedId && !carried) {
    setString(m, 'carried_entity', undefined);
  }
  const hang = carried ? (specOf(carried)?.height ?? 1) + 0.1 : getString(m, 'carried_block') ? 1.05 : 0;
  // The hook (and its load) stops on the ground: shorten the rope while it is inside a block.
  if (rope !== null && rope !== undefined) {
    const c = spec.channels[rope];
    for (let i = 0; i < 40; i++) {
      const h = tip(m, spec);
      if (isAir(block(m.dimension, h)) && isAir(block(m.dimension, { x: h.x, y: h.y - hang + 0.05, z: h.z }))) break;
      const v = m.getProperty(`${NS}:c${rope}`);
      if (v <= c.min) break;
      m.setProperty(`${NS}:c${rope}`, Math.max(c.min, v - 0.25));
    }
  }
  if (carried) {
    const h = tip(m, spec);
    try {
      carried.teleport({ x: h.x, y: h.y - hang, z: h.z }, { keepVelocity: false });
      carried.clearVelocity?.();
    } catch {}
  }
  // A tower crane stands on its mast: if the mast is gone, it comes down as a kit.
  if (spec.drive.type === 'none' && s.ticks % 20 === 0) {
    const below = block(m.dimension, { x: m.location.x, y: m.location.y - 0.5, z: m.location.z });
    if (below && below.typeId !== `${NS}:crane_mast`) breakApart(m, spec, true);
  }
}

function bladeTick(m, spec, s) {
  if (s.ticks % 2 !== 0 || forwardMotion(m, s) < 0.02) return;
  const op = operatorOf(m);
  if (!mayEdit(op)) return;
  const load = getLoad(m);
  const strip = spec.tool.strip;
  const f = forward(m);
  const right = { x: -f.z, y: 0, z: f.x };
  const cutY = Math.floor(m.location.y + 0.2) + Math.round(m.getProperty(`${NS}:c0`));
  const spread = modeOn(m);
  let changed = false;
  for (let d = -(strip.width - 1) / 2; d <= (strip.width - 1) / 2 + 0.01; d += 1) {
    const c = { x: m.location.x + f.x * strip.ahead + right.x * d, z: m.location.z + f.z * strip.ahead + right.z * d };
    for (let y = cutY; y <= cutY + 2; y++) {
      const b = block(m.dimension, { x: c.x, y, z: c.z });
      if (!canDig(b)) continue;
      if (total(load) >= spec.tool.capacity && !spread) {
        // A full blade pushes the heap ahead of it.
        const id = takeOne(load);
        if (!pour(m.dimension, { x: m.location.x + f.x * (strip.ahead + 1.6), y: cutY + 2, z: m.location.z + f.z * (strip.ahead + 1.6) }, id, op)) {
          load[id] = (load[id] ?? 0) + 1;
          continue;
        }
      }
      if (total(load) >= spec.tool.capacity) continue;
      const drop = dropOf(b);
      if (breakBlock(b, op)) {
        if (drop) load[drop] = (load[drop] ?? 0) + 1;
        changed = true;
      }
    }
  }
  if (spread || total(load) >= spec.tool.capacity) {
    for (let d = -(strip.width - 1) / 2; d <= (strip.width - 1) / 2 + 0.01 && total(load) > 0; d += 1) {
      const hole = block(m.dimension, { x: m.location.x + f.x * strip.ahead + right.x * d, y: cutY - 1, z: m.location.z + f.z * strip.ahead + right.z * d });
      if (!hole || !isAir(hole)) continue;
      const id = takeOne(load);
      if (!place(hole, id, op)) load[id] = (load[id] ?? 0) + 1;
      else changed = true;
    }
  }
  if (changed) saveLoad(m, spec, load);
}

function bedTick(m, spec, s) {
  if (s.ticks % 3 !== 0 || m.getProperty(`${NS}:c0`) < 40) return;
  const load = getLoad(m);
  if (!total(load)) return;
  const at = modelPoint(m, spec, [], spec.tool.pour);
  const id = takeOne(load);
  if (!pour(m.dimension, at, id, operatorOf(m))) load[id] = (load[id] ?? 0) + 1;
  saveLoad(m, spec, load);
}

function scoopTick(m, spec, s) {
  if (!spec.tool.scoop || s.ticks % 3 !== 0) return;
  if (m.getProperty(`${NS}:c0`) > spec.channels[0].min + 4 || forwardMotion(m, s) < 0.02) return;
  if (total(getLoad(m)) >= spec.tool.capacity || !mayEdit(operatorOf(m))) return;
  dig(m, spec, tip(m, spec), Math.floor(m.location.y + 0.2));
}

function drumTick(m, spec, s) {
  if (!modeOn(m) || s.ticks % 4 !== 0) return;
  const load = getLoad(m);
  if (!total(load)) return setMode(m, false);
  const colour = COLOURS[Number(getString(m, 'colour') ?? 7)] ?? 'gray';
  const at = tip(m, spec);
  if (pour(m.dimension, at, `minecraft:${colour}_concrete`, operatorOf(m))) {
    takeOne(load);
    saveLoad(m, spec, load);
    m.dimension.playSound('dig.gravel', at, { pitch: 0.6 });
  } else {
    setMode(m, false);
    tell(m, 'no_room');
  }
}

function rollerTick(m, spec, s) {
  if (s.ticks % 2 !== 0 || Math.abs(forwardMotion(m, s)) < 0.02) return;
  const op = operatorOf(m);
  if (!mayEdit(op)) return;
  const load = getLoad(m);
  const strip = spec.tool.strip;
  const f = forward(m);
  const right = { x: -f.z, y: 0, z: f.x };
  const y = Math.floor(m.location.y + 0.2);
  let changed = false;
  for (let d = -(strip.width - 1) / 2; d <= (strip.width - 1) / 2 + 0.01; d += 1) {
    const c = { x: m.location.x + f.x * strip.ahead + right.x * d, y, z: m.location.z + f.z * strip.ahead + right.z * d };
    const here = block(m.dimension, c);
    const above = block(m.dimension, add(c, { x: 0, y: 1, z: 0 }));
    if (here && !here.isAir && canDig(here) && above?.isAir && TERRAIN.KINDS[here.typeId] !== 1) {
      const drop = dropOf(here);
      if ((!drop || total(load) < spec.tool.capacity) && breakBlock(here, op)) {
        if (drop) load[drop] = (load[drop] ?? 0) + 1;
        changed = true;
      }
    }
    const ground = block(m.dimension, add(c, { x: 0, y: -1, z: 0 }));
    if (ground && isAir(ground) && total(load)) {
      const id = takeOne(load);
      if (!place(ground, id, op)) load[id] = (load[id] ?? 0) + 1;
      changed = true;
    } else if (ground && PATHABLE.has(ground.typeId) && block(m.dimension, c)?.isAir) {
      try { ground.setType('minecraft:grass_path'); } catch {}
    }
  }
  if (changed) saveLoad(m, spec, load);
}

let known = [];
let refresh = 0;

/** Every loaded machine (the list is refreshed once a second). */
function loadedMachines() {
  if (refresh-- <= 0) {
    refresh = 20;
    known = [];
    for (const id of ['overworld', 'nether', 'the_end']) {
      try {
        known.push(...world.getDimension(id).getEntities({ families: ['machine'] }));
      } catch {}
    }
  }
  return known;
}

/** Runs the tools of every loaded machine, every tick. */
export function tickTools() {
  for (const m of loadedMachines()) {
    if (!m.isValid) continue;
    const spec = specOf(m);
    if (!spec) continue;
    const s = mem(m);
    s.ticks++;
    try {
      switch (spec.tool.kind) {
        case 'bucket': scoopTick(m, spec, s); break;
        case 'blade': bladeTick(m, spec, s); break;
        case 'bed': bedTick(m, spec, s); break;
        case 'hook': hookTick(m, spec, s); break;
        case 'drum': drumTick(m, spec, s); break;
        case 'roller': rollerTick(m, spec, s); break;
        default: break;
      }
    } catch (e) {
      if (s.ticks % 200 === 1) console.warn(`[Construction Machines] ${spec.id}: ${e}`);
    }
    // Steering shows on articulated frames and front wheels.
    const yaw = m.getRotation().y;
    let turn = yaw - s.prevYaw;
    if (turn > 180) turn -= 360;
    if (turn < -180) turn += 360;
    s.steer = (s.steer ?? 0) * 0.8 + Math.max(-1, Math.min(1, turn / Math.max(1, spec.drive.turn))) * 0.2;
    if (s.ticks % 2 === 0) try { m.setProperty(`${NS}:steer`, Math.round(s.steer * 100) / 100); } catch {}
    s.prevYaw = yaw;
    s.last = m.location;
  }
}

// ------------------------------------------------------------ the mixer takes sand and dyes

export function interact(m, player, item) {
  const spec = specOf(m);
  if (!spec || spec.tool.kind !== 'drum' || !item) return false;
  if (item.typeId.endsWith('_dye')) {
    const colour = item.typeId.replace('minecraft:', '').replace('_dye', '').replace('lightblue', 'light_blue');
    const i = COLOURS.indexOf(colour === 'silver' ? 'light_gray' : colour);
    if (i >= 0) {
      setString(m, 'colour', String(i));
      player.onScreenDisplay.setActionBar({ translate: `${NS}.mixer.colour` });
      return true;
    }
  }
  if (TERRAIN.MIXABLE.includes(item.typeId)) {
    const load = getLoad(m);
    const n = Math.min(item.amount, spec.tool.capacity - total(load));
    if (n > 0) {
      load[item.typeId] = (load[item.typeId] ?? 0) + n;
      saveLoad(m, spec, load);
      return n;
    }
  }
  return false;
}

// ------------------------------------------------------------ breaking

/** Drops the load (and what it carries) when a machine is wrecked. */
export function dropContents(m, spec, loc, dim) {
  const load = getLoad(m);
  for (const [id, n] of Object.entries(load)) dropItem(dim, loc, id, n);
  const carried = getString(m, 'carried_block');
  if (carried) dropItem(dim, loc, carried, 1);
}

export function breakApart(m, spec, dropKit) {
  const loc = m.location, dim = m.dimension;
  dropContents(m, spec, loc, dim);
  if (dropKit) dropItem(dim, loc, `${NS}:${spec.id === 'tower_crane' ? 'tower_crane_kit' : spec.id}`, 1);
  try { m.remove(); } catch {}
}
