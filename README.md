# Construction Machines

A Minecraft **Bedrock Edition** add-on and **Java Edition** (Fabric) mod with 12 big construction machines that you can drive **and operate**: excavators that really dig, wheel loaders, bulldozers, dump trucks, a skid steer, crawler, mobile and tower cranes, a concrete mixer truck, a road roller, a forklift and a telehandler.

**Download and info: https://ulfendk.github.io/minecraft-machines/** (på dansk: https://ulfendk.github.io/minecraft-machines/da/)

![All machines](https://ulfendk.github.io/minecraft-machines/img/machines/excavator.png)

## Features
- 12 machines, each with its own model, moving parts and animations: tracks that run, wheels that roll and steer, articulated frames, booms, sticks, buckets, blades, beds, chutes, forks and hooks.
- **Real terrain work.** Buckets dig soil, sand, gravel and rock into a load and dump it on a pile or into a dump truck. Dump trucks tip their load out behind them. Bulldozers cut hills, push the spoil ahead and fill holes. The road roller packs grass into paths. The mixer turns sand and gravel into concrete in any colour.
- **Cranes** lift blocks, animals and even other machines, up to their load limit. The tower crane stands on a mast of crane mast blocks (12, 20 or 32 high) built by the Tower Crane Kit.
- **Safe for your builds:** machines never touch bedrock, obsidian, portals, spawners or anything with an inventory. Servers can turn terrain editing off (Java: `/gamerule machines:machine_terrain_editing false`, Bedrock: `/scriptevent machines:terrain off`). On Java, spawn protection, adventure mode and claim mods that use Fabric's block-break event are respected.
- A Machine Manual, given to every player, with a page per machine.
- English and Danish.

## How to operate
Climb in with right-click. Every machine drives like a boat: W/S and A/D. Sneak gets you out.

| | Java Edition | Bedrock |
| --- | --- | --- |
| First / second control | ← → / ↓ ↑ | Hotbar slot 2, then left/right and back/forward |
| Third / fourth control | K I / J U | Hotbar slot 3, then back/forward and left/right |
| Action (dig, dump, hook on, pick up …) | G | Jump |
| Control panel | H | shown above the hotbar |

Java keys can be changed under Options → Controls → Key Binds.

## Install
1. Download `ConstructionMachines.mcaddon` from the [latest release](https://github.com/ulfendk/minecraft-machines/releases/latest).
2. Open it on Windows, Android or iOS. Minecraft imports both packs.
3. In your world settings, turn on **Construction Machines** under *Behavior Packs*.

Requires Minecraft Bedrock 1.21.90 or newer.

### Java Edition
1. Install [Fabric Loader](https://fabricmc.net/use/installer/) for Minecraft 26.3.
2. Download `construction-machines-fabric-<version>.jar` from the [latest release](https://github.com/ulfendk/minecraft-machines/releases/latest), plus [Fabric API](https://modrinth.com/mod/fabric-api) and [GeckoLib](https://modrinth.com/mod/geckolib).
3. Put all three in your `mods` folder.

## Development
Everything is generated from code. Models, textures and animations come from the specs in `src/machines/`.

```sh
npm ci
npm run build      # writes build/behavior_pack, build/resource_pack and java/src/generated/resources
npm run validate   # static checks of the packs and the Java resources
npm test           # unit tests (kinematics, specs)
npm run preview    # renders every machine to build/preview/*.png
npm run package    # dist/*.mcaddon and *.mcpack
npm run site       # the website, in build/site/
npm run test:server  # loads the packs in a Bedrock Dedicated Server and runs the selftest (needs Docker)

cd java                       # Java edition (needs JDK 25; run `npm run build` first)
./gradlew build               # the Fabric mod jar in java/build/libs
./gradlew runGameTest         # server-side game tests: digging, tipping, levelling, lifting ...
./gradlew runClientGameTest   # starts a client, screenshots, drives and operates every machine
./gradlew runClient           # play it
```

The moving parts of each machine are described once, as *drivers* (`{ bone, prop, axis, terms }`), and used for the animations of both editions and for the forward kinematics that find the bucket teeth, hook or forks in the world. The JavaScript kinematics (`src/lib/kinematics.mjs`) run in the build and in the Bedrock scripts; `dk.ulfen.machines.machine.Kinematics` does the same on Java, and a game test checks that both agree.

| Path | What it is |
| --- | --- |
| `src/machines/*.mjs` | One file per machine: model, materials, drive, operating channels, tool, recipe, icon |
| `src/lib/` | Generators: model + UV packing, textures, parts, kinematics, animations, entity JSON |
| `src/diggable.mjs` | Which blocks may be dug, lifted, and never touched |
| `src/packs/` | Hand-written pack files, including the Script API code in `behavior_pack/scripts/` |
| `src/lang.mjs`, `src/i18n.mjs` | In-game texts and website texts, English and Danish |
| `tools/` | Build, validation, preview renderer, packaging, website, server test, Java resources |
| `java/` | The Fabric mod (Java edition) |

### Adding a machine
Copy a similar spec in `src/machines/`, add its id to `ORDER` in `src/lib/machines.mjs` and its Danish name and description to `src/i18n.mjs`. Run `npm run preview <id>` and look at `build/preview/<id>.png`.

### Releases
Bump `version` in `package.json`, add a section to `CHANGELOG.md`, then push a tag such as `v0.2.0`. The release workflow builds and tests both editions, publishes a GitHub Release with the files, and updates the website.

## License
MIT. Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
