import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMachines, ORDER } from '../src/lib/machines.mjs';
import { buildGeometry } from '../src/lib/model.mjs';
import { machineAnimation } from '../src/lib/anim.mjs';
import { runtimeRecord } from '../src/lib/behavior.mjs';
import { fkFixtures } from '../tools/java.mjs';
import { CHANNEL_NAMES, ACTION_NAMES, STRINGS } from '../src/i18n.mjs';
import { DIG, NEVER, LIFT } from '../src/diggable.mjs';

const machines = await loadMachines();

test('all twelve machines load, in the display order', () => {
  assert.deepEqual(machines.map((m) => m.id), ORDER);
});

for (const m of machines) {
  test(`${m.id}: model packs into a texture and animates only existing bones`, () => {
    const geo = buildGeometry(`geometry.machines.${m.id}`, m.model);
    assert.ok(geo.width <= 512 && geo.height <= 512);
    const bones = new Set(m.model.bones.map((b) => b.name));
    for (const anim of Object.values(machineAnimation(m, 'bedrock').animations)) {
      for (const b of Object.keys(anim.bones)) assert.ok(bones.has(b), `animates missing bone ${b}`);
    }
  });

  test(`${m.id}: has names and translations for its channels and action`, () => {
    for (const c of m.channels) assert.ok(CHANNEL_NAMES[c.id], `no name for channel ${c.id}`);
    assert.ok(ACTION_NAMES[m.tool.kind] || m.tool.kind === 'none');
    assert.ok(STRINGS.da.names[m.id], 'no Danish name');
    assert.ok(STRINGS.da.info[m.id], 'no Danish description');
  });

  test(`${m.id}: its tool makes sense`, () => {
    const r = runtimeRecord(m);
    if (['bucket', 'hook', 'forks', 'drum'].includes(r.tool.kind)) assert.ok(r.tool.tip, 'needs a tool tip');
    if (['bucket', 'blade', 'bed', 'drum', 'roller'].includes(r.tool.kind)) assert.ok(r.tool.capacity > 0, 'needs a capacity');
    if (r.tool.kind === 'hook') assert.ok(r.tool.lift > 0 && r.tool.rope !== null, 'cranes need a lift limit and a hoist channel');
    if (['blade', 'roller'].includes(r.tool.kind)) assert.ok(r.tool.strip, 'needs a strip');
    if (r.tool.kind === 'bed') assert.ok(r.tool.pour, 'needs a pour point');
  });
}

test('the kinematics fixtures for the Java test cover every machine with a tool tip', () => {
  const fixtures = fkFixtures(machines.map(runtimeRecord));
  const ids = new Set(fixtures.map((f) => f.id));
  for (const m of machines) if (m.tool.tip) assert.ok(ids.has(m.id), m.id);
  for (const f of fixtures) assert.ok(f.tip.every(Number.isFinite));
});

test('protected blocks are never diggable or liftable', () => {
  for (const id of NEVER) {
    assert.ok(!DIG.includes(id), `${id} is diggable`);
    assert.ok(!LIFT.includes(id), `${id} is liftable`);
  }
  assert.ok(NEVER.includes('bedrock') && NEVER.includes('chest'));
});
