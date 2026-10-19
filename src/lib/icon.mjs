// Pack icon: a yellow excavator digging at dusk, a red tower crane behind it and a
// hazard stripe along the bottom. Drawn at 32x32 and scaled up.
import { PNG } from 'pngjs';
import { hex, mix } from './texture.mjs';

export function packIcon(scale = 8) {
  const N = 32;
  const px = Array.from({ length: N }, () => new Array(N));
  const sky = [hex('#1d2a4f'), hex('#5b3f78'), hex('#e0773a'), hex('#ffcf6b')];
  for (let y = 0; y < N; y++) {
    const t = y / 24;
    const c = t < 0.4 ? mix(sky[0], sky[1], t / 0.4) : t < 0.8 ? mix(sky[1], sky[2], (t - 0.4) / 0.4) : mix(sky[2], sky[3], Math.min(1, (t - 0.8) / 0.2));
    for (let x = 0; x < N; x++) px[y][x] = c;
  }
  const put = (x, y, c) => { if (x >= 0 && x < N && y >= 0 && y < N) px[y][x] = hex(c); };
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };

  // Tower crane (red lattice) on the right, in the distance.
  const red = '#c8261b', darkRed = '#7a1610';
  for (let y = 4; y <= 24; y++) { put(26, y, red); put(28, y, red); if (y % 2 === 0) put(27, y, darkRed); }
  fill(14, 4, 31, 4, red); // jib
  for (let x = 15; x <= 31; x += 2) put(x, 5, darkRed);
  fill(27, 1, 27, 3, red); // peak
  put(29, 3, '#333333'); put(30, 3, '#333333'); fill(29, 5, 31, 6, '#555555'); // counterweight
  for (let y = 5; y <= 11; y++) put(18, y, '#222222'); // rope
  fill(17, 12, 19, 13, '#f2b705'); // hook block

  // Ground: a dirt mound being dug.
  for (let y = 22; y < N; y++) for (let x = 0; x < N; x++) px[y][x] = hex(y === 22 ? '#4e7a2f' : (x * 7 + y * 3) % 5 ? '#6b4c2f' : '#5a3f27');
  for (let x = 0; x < 9; x++) for (let y = 20 - Math.max(0, 4 - Math.abs(x - 4)); y < 23; y++) put(x, y, (x + y) % 3 ? '#6b4c2f' : '#7a5838');

  // Excavator: tracks, body, cab, boom, stick and bucket in the mound.
  const yel = '#f2b705', shade = '#c99004', blk = '#232323';
  fill(8, 21, 21, 23, blk);
  for (let x = 9; x <= 20; x += 2) put(x, 22, '#555555');
  fill(10, 17, 21, 20, yel);
  fill(10, 20, 21, 20, shade);
  fill(16, 12, 21, 16, yel); // cab
  fill(17, 13, 20, 15, '#9fd3e6');
  fill(21, 15, 22, 19, '#333333'); // counterweight
  // Boom from the body up and to the left, then the stick down into the mound.
  const boom = [[11, 16], [10, 15], [9, 14], [8, 13], [7, 12], [6, 11], [5, 11], [4, 12]];
  for (const [x, y] of boom) { put(x, y, yel); put(x, y + 1, shade); }
  for (let y = 13; y <= 18; y++) { put(3, y, yel); put(4, y, shade); }
  fill(1, 18, 4, 20, '#8a8a8a'); // bucket
  fill(2, 19, 3, 19, '#6b4c2f');

  // Hazard stripe.
  for (let y = 27; y < N; y++) for (let x = 0; x < N; x++) px[y][x] = hex(Math.floor((x + y) / 3) % 2 ? '#f2b705' : '#1b1c1d');

  const png = new PNG({ width: N * scale, height: N * scale });
  for (let y = 0; y < N * scale; y++) for (let x = 0; x < N * scale; x++) {
    png.data.set(px[Math.floor(y / scale)][Math.floor(x / scale)], (y * N * scale + x) * 4);
  }
  return PNG.sync.write(png);
}
