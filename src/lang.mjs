// In-game texts (.lang files on Bedrock; tools/java.mjs converts them for Java).
import { NS } from './lib/constants.mjs';
import { ACTION_NAMES, CHANNEL_NAMES, STRINGS } from './i18n.mjs';

export const LOCALES = ['en_US', 'da_DK'];

/** Messages and HUD texts: key -> [English, Danish]. %s / %1$s are filled in at runtime. */
const UI = {
  [`action.interact.${NS}.operate`]: ['Get in', 'Stig ind'],
  [`${NS}.mode.0`]: ['DRIVE', 'KØR'],
  [`${NS}.mode.1`]: ['ARM', 'ARM'],
  [`${NS}.mode.2`]: ['TOOL', 'VÆRKTØJ'],
  [`${NS}.hud.slots`]: ['Slot 1 Drive · 2 Arm · 3 Tool · Jump: Action', 'Plads 1 Kør · 2 Arm · 3 Værktøj · Hop: Handling'],
  [`${NS}.hud.lr`]: ['Left/right', 'Venstre/højre'],
  [`${NS}.hud.fb`]: ['Forward/back', 'Frem/tilbage'],
  [`${NS}.hud.jump`]: ['Jump', 'Hop'],
  [`${NS}.hud.action`]: ['Action', 'Handling'],
  [`${NS}.hud.load`]: ['Load', 'Last'],
  [`${NS}.hud.rope`]: ['Rope', 'Wire'],
  [`${NS}.hud.drive`]: ['W/S drive · A/D steer', 'W/S kør · A/D styr'],
  [`${NS}.hud.spread`]: ['Spreading', 'Fordeler'],
  [`${NS}.hud.pouring`]: ['Pouring', 'Hælder'],
  [`${NS}.hud.carrying`]: ['Carrying', 'Bærer'],
  [`${NS}.hud.toggle`]: ['Show/hide controls', 'Vis/skjul knapper'],
  [`${NS}.tutorial`]: [
    '§eYou are operating a machine.§r Select hotbar slot 1 to drive, 2 or 3 to work the arm and tool. Jump does the action, sneak gets you out.',
    '§eDu betjener en maskine.§r Vælg plads 1 i hotbaren for at køre, 2 eller 3 for at styre arm og værktøj. Hop udfører handlingen, snig får dig ud.',
  ],
  [`${NS}.tutorial.java`]: [
    '§eYou are operating a machine.§r Drive with W/A/S/D. Arrow keys, I/K and U/J work the arm and tool, G does the action. Press H to show or hide the controls.',
    '§eDu betjener en maskine.§r Kør med W/A/S/D. Piletasterne, I/K og U/J styrer arm og værktøj, G udfører handlingen. Tryk H for at vise eller skjule knapperne.',
  ],
  [`${NS}.too_heavy`]: ['Too heavy for this crane!', 'For tungt til denne kran!'],
  [`${NS}.full`]: ['The bucket is full', 'Skovlen er fuld'],
  [`${NS}.nothing`]: ['Nothing here to dig', 'Intet at grave her'],
  [`${NS}.protected`]: ['Machines may not change the ground here', 'Maskiner må ikke ændre terrænet her'],
  [`${NS}.no_room`]: ['Not enough room here', 'Ikke plads nok her'],
  [`${NS}.mixer.only`]: ['The mixer only takes sand and gravel', 'Betonbilen tager kun sand og grus'],
  [`${NS}.mixer.colour`]: ['Concrete colour set', 'Betonfarve valgt'],
  [`${NS}.kit.height`]: ['Mast height: %s blocks', 'Masthøjde: %s blokke'],
  [`${NS}.terrain.on`]: ['Machines can change the terrain', 'Maskiner kan ændre terrænet'],
  [`${NS}.terrain.off`]: ['Machines can no longer change the terrain', 'Maskiner kan ikke længere ændre terrænet'],
  [`${NS}.manual.title`]: ['Machine Manual', 'Maskinhåndbog'],
  [`${NS}.manual.intro`]: [
    'Place a machine and right-click it to climb in. Pick a machine to read how it works.',
    'Stil en maskine, og højreklik på den for at kravle ind. Vælg en maskine for at læse, hvordan den virker.',
  ],
  [`${NS}.manual.controls`]: ['Controls', 'Betjening'],
  [`${NS}.manual.back`]: ['Back', 'Tilbage'],
  [`${NS}.manual.capacity`]: ['Load: %s blocks', 'Last: %s blokke'],
  [`${NS}.manual.lift`]: ['Lifts up to %s (a mob counts 1, a machine its weight)', 'Løfter op til %s (et dyr tæller 1, en maskine sin vægt)'],
  [`${NS}.manual.weight`]: ['Weight: %s', 'Vægt: %s'],
  [`${NS}.manual.welcome`]: [
    '§6You received a Machine Manual!§r Use it to see how the construction machines work.',
    '§6Du har fået en maskinhåndbog!§r Brug den til at se, hvordan entreprenørmaskinerne virker.',
  ],
  [`${NS}.manual.bedrock_controls`]: [
    'Slot 1: drive (W/S, A/D). Slot 2: arm (left/right = first control, forward/back = second). Slot 3: tool (left/right = fourth, forward/back = third). Jump: action. Sneak: climb out.',
    'Plads 1: kør (W/S, A/D). Plads 2: arm (venstre/højre = første funktion, frem/tilbage = anden). Plads 3: værktøj (venstre/højre = fjerde, frem/tilbage = tredje). Hop: handling. Snig: kravl ud.',
  ],
  'key.category.machines.machines': ['Construction Machines', 'Entreprenørmaskiner'],
  [`key.${NS}.c0_neg`]: ['Control 1 −', 'Funktion 1 −'],
  [`key.${NS}.c0_pos`]: ['Control 1 +', 'Funktion 1 +'],
  [`key.${NS}.c1_neg`]: ['Control 2 −', 'Funktion 2 −'],
  [`key.${NS}.c1_pos`]: ['Control 2 +', 'Funktion 2 +'],
  [`key.${NS}.c2_neg`]: ['Control 3 −', 'Funktion 3 −'],
  [`key.${NS}.c2_pos`]: ['Control 3 +', 'Funktion 3 +'],
  [`key.${NS}.c3_neg`]: ['Control 4 −', 'Funktion 4 −'],
  [`key.${NS}.c3_pos`]: ['Control 4 +', 'Funktion 4 +'],
  [`key.${NS}.action`]: ['Machine action', 'Maskinhandling'],
  [`key.${NS}.hud`]: ['Show/hide machine controls', 'Vis/skjul maskinknapper'],
};

/**
 * Lang entries for one locale as [key, value] pairs.
 */
export function langEntries(locale, { machines, items, blocks, description, version }) {
  const i = Math.max(0, LOCALES.indexOf(locale));
  const da = locale === 'da_DK' ? STRINGS.da : null;
  const pick = (pair) => pair[i] ?? pair[0];
  const out = [];
  out.push(['pack.description', da
    ? `Construction Machines: gravemaskiner, gummiged, dumpere, bulldozere og kraner, som du kan køre og betjene (v${version})`
    : `${description} (v${version})`]);
  for (const m of machines) {
    out.push([`entity.${NS}:${m.id}.name`, da?.names[m.id] ?? m.name]);
    out.push([`${NS}.info.${m.id}`, da?.info[m.id] ?? m.info]);
    m.channels.forEach((c, n) => {
      const names = CHANNEL_NAMES[c.id];
      if (!names) throw new Error(`Add a name for channel "${c.id}" to CHANNEL_NAMES in src/i18n.mjs`);
      out.push([`${NS}.channel.${m.id}.${n}`, pick(names)]);
    });
    out.push([`${NS}.action.${m.id}`, pick(ACTION_NAMES[m.tool.kind] ?? ['–', '–'])]);
  }
  for (const item of items) out.push([`item.${NS}:${item.id}.name`, da?.names[item.id] ?? item.name]);
  for (const block of blocks) out.push([`tile.${NS}:${block.id}.name`, da?.names[block.id] ?? block.name]);
  for (const [key, pair] of Object.entries(UI)) out.push([key, pick(pair)]);
  return out;
}
