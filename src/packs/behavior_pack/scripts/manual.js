// The Machine Manual: a page per machine with what it does and how to work it.
import { ItemStack, system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { MACHINES } from './data.js';
import { NS } from './util.js';

const GIVEN = `${NS}:manual_given`;
const nameOf = (m) => ({ translate: `entity.${NS}:${m.id}.name` });

function openIndex(player) {
  const form = new ActionFormData().title({ translate: `${NS}.manual.title` }).body({ translate: `${NS}.manual.intro` });
  form.button({ translate: `${NS}.manual.controls` }, 'textures/ui/controller_glyph_color');
  for (const m of MACHINES) form.button(nameOf(m), `textures/ui/${NS}/${m.id}`);
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    if (res.selection === 0) return openControls(player);
    openEntry(player, MACHINES[res.selection - 1]);
  });
}

function back(player, title, body) {
  new ActionFormData().title(title).body({ rawtext: body }).button({ translate: `${NS}.manual.back` }).show(player).then((res) => {
    if (!res.canceled) openIndex(player);
  });
}

function openControls(player) {
  back(player, { translate: `${NS}.manual.controls` }, [{ translate: `${NS}.manual.bedrock_controls` }]);
}

function openEntry(player, m) {
  const body = [{ translate: `${NS}.info.${m.id}` }, { text: '\n' }];
  m.channels.forEach((c, i) => body.push({ text: `\n§2${i < 2 ? '2' : '3'}§r ` }, { translate: `${NS}.channel.${m.id}.${i}` }));
  body.push({ text: '\n§2' }, { translate: `${NS}.hud.jump` }, { text: '§r ' }, { translate: `${NS}.action.${m.id}` });
  if (m.tool.lift) body.push({ text: '\n\n' }, { translate: `${NS}.manual.lift`, with: [String(m.tool.lift)] });
  else if (m.tool.capacity) body.push({ text: '\n\n' }, { translate: `${NS}.manual.capacity`, with: [String(m.tool.capacity)] });
  body.push({ text: '\n' }, { translate: `${NS}.manual.weight`, with: [String(m.mass)] });
  back(player, nameOf(m), body);
}

export function setupManual() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== `${NS}:machine_manual`) return;
    source.playSound('item.book.page_turn');
    system.run(() => openIndex(source));
  });
  // Everyone gets a manual the first time they join a world with the add-on.
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn || player.getDynamicProperty(GIVEN)) return;
    player.setDynamicProperty(GIVEN, true);
    system.runTimeout(() => {
      try {
        player.getComponent('minecraft:inventory')?.container?.addItem(new ItemStack(`${NS}:machine_manual`, 1));
        player.sendMessage({ translate: `${NS}.manual.welcome` });
      } catch {
        // Player left before the timeout.
      }
    }, 60);
  });
}
