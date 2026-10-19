// Stacks the top row (at rest and at work) of several previews: node tools/compare.mjs excavator bulldozer ...
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { sheet } from './render.mjs';

const rows = process.argv.slice(2).map((id) => {
  const src = PNG.sync.read(readFileSync(`build/preview/${id}.png`));
  const out = new PNG({ width: 768, height: 256 });
  PNG.bitblt(src, out, 0, 0, 768, 256, 0, 0);
  return PNG.sync.write(out);
});
writeFileSync('build/preview/_compare.png', sheet(rows, { cols: 1, cellW: 768, cellH: 256 }));
