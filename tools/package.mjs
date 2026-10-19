// Zips build/ into installable files in dist/:
//   SafariAnimals-<version>.mcaddon        (both packs; double-click to import)
//   SafariAnimals_BP-<version>.mcpack      (behavior pack only)
//   SafariAnimals_RP-<version>.mcpack      (resource pack only)
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const v = pkg.version;

async function collect(dir, prefix = '') {
  const files = {};
  async function walk(d) {
    for (const name of await readdir(d)) {
      const p = join(d, name);
      if ((await stat(p)).isDirectory()) await walk(p);
      else files[join(prefix, relative(dir, p)).split('\\').join('/')] = new Uint8Array(await readFile(p));
    }
  }
  await walk(dir);
  return files;
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const bp = await collect('build/behavior_pack');
const rp = await collect('build/resource_pack');
const outputs = {
  [`SafariAnimals_BP-${v}.mcpack`]: bp,
  [`SafariAnimals_RP-${v}.mcpack`]: rp,
  [`SafariAnimals-${v}.mcaddon`]: {
    ...(await collect('build/behavior_pack', 'SafariAnimals_BP')),
    ...(await collect('build/resource_pack', 'SafariAnimals_RP')),
  },
};
for (const [name, files] of Object.entries(outputs)) {
  const zip = zipSync(files, { level: 9 });
  await writeFile(join('dist', name), zip);
  console.log(`dist/${name}  ${(zip.length / 1024).toFixed(0)} KB`);
}
