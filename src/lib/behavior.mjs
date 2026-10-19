// Machine spec -> Bedrock behavior-pack entity, loot table, and the runtime record
// that both the Bedrock scripts (scripts/data.js) and the Java mod (machines.json) read.
import { NS } from './constants.mjs';
import { chainTo, pointOn, toLocal } from './kinematics.mjs';
import { restValues } from './machines.mjs';

const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Bedrock wants float properties written as decimals (0.0, not 0), which JSON.stringify
 * can't do: floats are tagged here and written out by floatJson().
 */
const float = (n) => `F:${Number(n)}`;
export const floatJson = (data) => JSON.stringify(data, null, 2)
  .replace(/"F:(-?[\d.e-]+)"/g, (_, n) => (n.includes('.') ? n : `${n}.0`)) + '\n';

/** Entity properties that carry the operating state to the client. */
export function properties(m) {
  const props = {};
  m.channels.forEach((c, i) => {
    props[`${NS}:c${i}`] = { type: 'float', range: [float(c.min), float(c.max)], default: float(c.rest), client_sync: true };
  });
  props[`${NS}:load`] = { type: 'float', range: [float(0), float(1)], default: float(0), client_sync: true };
  props[`${NS}:kind`] = { type: 'int', range: [0, 3], default: 0, client_sync: true };
  props[`${NS}:steer`] = { type: 'float', range: [float(-1), float(1)], default: float(0), client_sync: true };
  props[`${NS}:carry`] = { type: 'bool', default: false, client_sync: true };
  props[`${NS}:pour`] = { type: 'bool', default: false, client_sync: true };
  props[`${NS}:mode`] = { type: 'int', range: [0, 2], default: 0, client_sync: true };
  return props;
}

/** Seat positions in entity space at rest (blocks, +z forward); riders sit a little into the seat. */
export function seatPositions(m) {
  const values = restValues(m);
  return m.seats.map((s) => {
    const p = s.bone ? pointOn(chainTo(m.model.bones, s.bone), m.drivers ?? [], values, s.at) : s.at;
    const [x, y, z] = toLocal(p, m.scale);
    return [r3(x), r3(y - 0.15), r3(z)];
  });
}

export function buildEntity(m) {
  const drives = m.drive.type !== 'none';
  const seats = seatPositions(m).map((position) => ({
    min_rider_count: 0, max_rider_count: m.seats.length, position, third_person_camera_radius: m.camera ?? 8,
  }));
  const components = {
    'minecraft:type_family': { family: ['machine', m.group, 'inanimate'] },
    'minecraft:collision_box': { width: m.hitbox.width, height: m.hitbox.height },
    'minecraft:health': { value: m.health, max: m.health },
    'minecraft:physics': drives ? {} : { has_gravity: false },
    'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
    'minecraft:knockback_resistance': { value: 1 },
    'minecraft:nameable': {},
    'minecraft:persistent': {},
    'minecraft:is_tamed': {},
    'minecraft:is_saddled': {},
    'minecraft:movement': { value: drives ? m.drive.speed : 0 },
    'minecraft:movement.basic': {},
    'minecraft:jump.static': {},
    'minecraft:navigation.walk': { can_path_over_water: false, avoid_water: true },
    'minecraft:variable_max_auto_step': { base_value: 1.0625, controlled_value: 1.0625, jump_prevented_value: 0.5625 },
    'minecraft:behavior.player_ride_tamed': { priority: 0 },
    'minecraft:rideable': {
      seat_count: m.seats.length, crouching_skip_interact: true, family_types: ['player'],
      interact_text: `action.interact.${NS}.operate`, seats,
    },
    'minecraft:breathable': { breathes_air: true, breathes_water: true, suffocate_time: 0, total_supply: 15 },
    'minecraft:fire_immune': {},
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'fall', deals_damage: 'no' },
        { cause: 'drowning', deals_damage: 'no' },
        { cause: 'suffocation', deals_damage: 'no' },
        { cause: 'fly_into_wall', deals_damage: 'no' },
        // Only players can wreck a machine (and get it back as an item).
        { on_damage: { filters: { test: 'is_family', subject: 'other', operator: '!=', value: 'player' } }, deals_damage: 'no' },
      ],
    },
    'minecraft:loot': { table: `loot_tables/entities/${NS}_${m.id}.json` },
    'minecraft:conditional_bandwidth_optimization': {},
  };
  const groups = {};
  const events = {};
  if (drives) {
    // Driving and operating modes: while operating, the movement keys work the arm instead.
    groups[`${NS}:drive`] = { 'minecraft:input_ground_controlled': {}, 'minecraft:movement': { value: m.drive.speed } };
    groups[`${NS}:operate`] = { 'minecraft:input_ground_controlled': {}, 'minecraft:movement': { value: 0 } };
    events[`${NS}:drive`] = { add: { component_groups: [`${NS}:drive`] }, remove: { component_groups: [`${NS}:operate`] } };
    events[`${NS}:operate`] = { add: { component_groups: [`${NS}:operate`] }, remove: { component_groups: [`${NS}:drive`] } };
    events['minecraft:entity_spawned'] = { add: { component_groups: [`${NS}:drive`] } };
  }
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: { identifier: `${NS}:${m.id}`, is_spawnable: false, is_summonable: true, properties: properties(m) },
      component_groups: groups,
      components,
      events,
    },
  };
}

export const buildLoot = (m) => ({
  pools: [{ rolls: 1, entries: [{ type: 'item', name: `${NS}:${m.id === 'tower_crane' ? 'tower_crane_kit' : m.id}`, weight: 1 }] }],
});

/**
 * Everything the game logic needs about a machine, for both editions. Positions are in
 * model pixels; the runtime converts them with toLocal()/toWorld() (or the Java equivalent).
 */
export function runtimeRecord(m) {
  const chain = (bone) => chainTo(m.model.bones, bone);
  const fkDrivers = (m.drivers ?? []).filter((d) => d.prop === 'rotation' || d.prop === 'position').map((d) => ({
    bone: d.bone, prop: d.prop, axis: d.axis, terms: d.terms, base: d.base ?? 0,
  }));
  return {
    id: m.id,
    group: m.group,
    scale: m.scale,
    width: m.hitbox.width,
    height: m.hitbox.height,
    health: m.health,
    mass: m.mass,
    camera: m.camera ?? 8,
    seats: m.seats.map((s, i) => ({ bone: s.bone ?? null, at: s.at, chain: s.bone ? chain(s.bone) : [], rest: seatPositions(m)[i] })),
    drive: {
      type: m.drive.type, speed: m.drive.speed ?? 0, accel: m.drive.accel ?? 0.02, brake: m.drive.brake ?? 0.05,
      reverse: m.drive.reverse ?? 0.5, turn: m.drive.turn ?? 4,
    },
    channels: m.channels.map((c) => ({ id: c.id, min: c.min, max: c.max, rate: c.rate, rest: c.rest, wrap: !!c.wrap })),
    drivers: fkDrivers,
    tool: {
      kind: m.tool.kind,
      tip: m.tool.tip ? { bone: m.tool.tip.bone, at: m.tool.tip.at, chain: chain(m.tool.tip.bone) } : null,
      reach: m.tool.reach ?? 1,
      capacity: m.tool.capacity ?? 0,
      maxHardness: m.tool.maxHardness ?? 3,
      lift: m.tool.lift ?? 0,
      rope: m.tool.rope ?? null,
      // Bulldozer blade and road roller: a strip in front of / under the machine.
      strip: m.tool.strip ?? null,
      // Dump truck bed: where loads are poured out (model pixels).
      pour: m.tool.pour ?? null,
      scoop: !!m.tool.scoop,
    },
  };
}
