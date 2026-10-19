import { ItemStack, system, world } from '@minecraft/server';
import { ITEMS } from './data.js';
import { buildTowerCrane } from './place.js';
import { getLoad, setLoad, total } from './state.js';
import { action } from './tools.js';
import { NS, SPECS, tip } from './util.js';

/**
 * Used by tools/bds-test.sh: checks that every machine exists, that every item does,
 * and runs a small scenario: an excavator digs dirt but not bedrock, a dump truck tips
 * its load out, and the kit builds a tower crane. Message = space-separated expected ids.
 */
export function selfTest(message) {
  const expected = message.split(/\s+/).filter(Boolean);
  const dim = world.getDimension('overworld');
  const counts = {};
  for (const e of dim.getEntities()) {
    if (e.typeId.startsWith(`${NS}:`)) counts[e.typeId] = (counts[e.typeId] ?? 0) + 1;
  }
  const missing = expected.filter((id) => !counts[`${NS}:${id}`]);
  for (const id of ITEMS) {
    try {
      new ItemStack(id, 1);
    } catch {
      missing.push(id);
    }
  }
  console.log(`[Construction Machines] selftest found ${JSON.stringify(counts)}`);

  // Scenario, west of the summoned machines.
  const ex = dim.spawnEntity(`${NS}:excavator`, { x: -20.5, y: -60, z: -20.5 });
  ex.setRotation({ x: 0, y: 0 });
  const ex2 = dim.spawnEntity(`${NS}:excavator`, { x: -36.5, y: -60, z: -20.5 });
  ex2.setRotation({ x: 0, y: 0 });
  const truck = dim.spawnEntity(`${NS}:dump_truck`, { x: -20.5, y: -60, z: -40.5 });
  setLoad(truck, { 'minecraft:dirt': 6 }, SPECS[`${NS}:dump_truck`].tool.capacity);
  system.runTimeout(() => {
    const t = tip(ex, SPECS[`${NS}:excavator`]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      dim.getBlock({ x: Math.floor(t.x) + dx, y: Math.floor(t.y) + dy, z: Math.floor(t.z) + dz })?.setType('minecraft:dirt');
    }
    const t2 = tip(ex2, SPECS[`${NS}:excavator`]);
    const rock = { x: Math.floor(t2.x), y: Math.floor(t2.y), z: Math.floor(t2.z) };
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      dim.getBlock({ x: rock.x + dx, y: rock.y + dy, z: rock.z + dz })?.setType('minecraft:bedrock');
    }
    action(ex);
    action(ex2);
    truck.setProperty(`${NS}:c0`, 55);
    buildTowerCrane(dim, { x: -40, y: -60, z: -40 }, 12, 0);
  }, 10);
  system.runTimeout(() => {
    if (total(getLoad(ex)) === 0) missing.push('excavator digging');
    if (total(getLoad(ex2)) !== 0) missing.push('excavator left bedrock alone');
    if (total(getLoad(truck)) !== 0) missing.push('dump truck tipping');
    if (!dim.getEntities({ type: `${NS}:tower_crane` }).length) missing.push('tower crane kit');
    console.log(missing.length ? `[Construction Machines] selftest FAIL missing: ${missing.join(' ')}` : '[Construction Machines] selftest PASS');
  }, 60);
}
