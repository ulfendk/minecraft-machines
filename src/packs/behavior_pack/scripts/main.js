import { system, world } from '@minecraft/server';
import { setupControls } from './controls.js';
import { setupManual } from './manual.js';
import { setupPlacing } from './place.js';
import { forget, mem } from './state.js';
import { setEnabled } from './terrain.js';
import { dropContents, tickTools } from './tools.js';
import { selfTest } from './selftest.js';
import { NS, specOf } from './util.js';

setupPlacing(); // registers custom components at startup

world.afterEvents.worldLoad.subscribe(() => {
  setupControls();
  setupManual();
  system.runInterval(tickTools, 1);
  console.log('[Construction Machines] loaded');
});

// A wrecked machine drops its load (its item comes from the loot table).
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  const spec = specOf(deadEntity);
  if (!spec) return;
  try {
    dropContents(deadEntity, spec, deadEntity.location, deadEntity.dimension);
  } catch {}
  forget(deadEntity.id);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === `${NS}:selftest`) selfTest(event.message);
  if (event.id === `${NS}:terrain`) {
    const on = event.message.trim() !== 'off';
    setEnabled(on);
    world.sendMessage({ translate: `${NS}.terrain.${on ? 'on' : 'off'}` });
  }
});

export { mem };
