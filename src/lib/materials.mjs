// Material recipes for machines: painted steel with worn edges, bare metal, rubber,
// glass and the like. Each returns a { base, layers } material for paintTexture().
import { fbm, hex, mix, mottle, shade, fur } from './texture.mjs';

export const PALETTE = {
  yellow: '#f2b705',
  orange: '#e8771e',
  red: '#c8261b',
  white: '#e9e6dc',
  green: '#3f7a35',
  blue: '#2f5d9a',
  steel: '#7d848a',
  dark: '#2c2e30',
  black: '#1b1c1d',
};

/** Darkens edges and corners of each face a little: chipped, dusty paint. */
const wear = (amount = 0.12) => (c, { i, j, fw, fh }) => {
  const edge = Math.min(i, j, fw - 1 - i, fh - 1 - j);
  return edge === 0 && fw > 2 && fh > 2 ? shade(c, 1 - amount) : c;
};

/** Mud splashed onto the lower part of the machine (y below `to` pixels). */
export const mud = (to = 6, { color = '#5b4630', seed = 5 } = {}) => (c, { p }) => {
  const t = (to - p[1]) / to;
  if (t <= 0) return c;
  const n = fbm(p[0] / 3, p[1] / 3, p[2] / 3, seed);
  return n < t * 0.8 ? mix(c, hex(color), 0.55 + n * 0.3) : c;
};

export const paint = (color, { mudTo = 0, wearAmount = 0.12 } = {}) => ({
  base: color,
  layers: [mottle(0.06, { scale: 8 }), fur(0.03), wear(wearAmount), ...(mudTo ? [mud(mudTo)] : [])],
});

export const metal = (color = PALETTE.steel) => ({ base: color, layers: [fur(0.06), mottle(0.05)], shading: 0.18 });

export const chrome = () => ({ base: '#c9d0d4', layers: [fur(0.05)], shading: 0.25 });

export const rubber = (color = '#262626') => ({ base: color, layers: [fur(0.05)], shading: 0.1 });

// Both faces of a pane are drawn (the materials don't cull back faces), so the alpha counts twice:
// 0x48 per face is about 50% opaque through the pane.
export const glass = () => ({ base: '#b4dcec48', layers: [(c, { i, j }) => ((i + j) % 7 === 0 ? shade(c, 1.25) : c)], shading: 0.05 });

/** Tyre with tread blocks across the rolling surface and a darker side wall. */
export const tyre = () => ({
  base: '#2a2a2a',
  shading: 0.1,
  layers: [
    (c, { face, j }) => (face === 'left' || face === 'right' ? shade(c, 0.85) : j % 2 === 0 ? shade(c, 0.7) : c),
    fur(0.04),
  ],
});

/** Crawler track: steel grousers every other texel along the track. */
export const track = () => ({
  base: '#3a3a3a',
  shading: 0.12,
  layers: [(c, { p, face }) => (face === 'left' || face === 'right' ? shade(c, 0.8) : Math.floor(p[2] + 1000) % 2 === 0 ? shade(c, 0.65) : c), fur(0.05)],
});

/** Yellow and black diagonal warning stripes. */
export const hazard = (period = 4) => ({
  base: PALETTE.yellow,
  shading: 0.1,
  layers: [(c, { p }) => (((Math.floor((p[0] + p[1] + p[2]) / (period / 2)) % 2) + 2) % 2 ? hex(PALETTE.black) : c)],
});

/** Spiral stripe for a concrete mixer drum (around the z axis). */
export const drumStripes = (color, stripe) => ({
  base: color,
  layers: [(c, { p }) => {
    const a = Math.atan2(p[1] - 20, p[0]) / (2 * Math.PI);
    return ((((p[2] / 10 + a) % 1) + 1) % 1) < 0.25 ? hex(stripe) : c;
  }, mottle(0.05)],
});

export const lamp = (color = '#fff1b0') => ({ base: color, shading: 0 });

export const seat = () => ({ base: '#3b3b3b', layers: [fur(0.06)], shading: 0.15 });

/** Bulk material carried in buckets and beds. */
export const soil = () => ({ base: '#6b4c2f', layers: [(c, { p }) => shade(c, 0.8 + fbm(p[0] / 2, p[1] / 2, p[2] / 2, 9) * 0.4)], shading: 0.08 });
export const rock = () => ({ base: '#7f7f7f', layers: [(c, { p }) => shade(c, 0.75 + fbm(p[0] / 1.5, p[1] / 1.5, p[2] / 1.5, 4) * 0.5)], shading: 0.08 });
export const sand = () => ({ base: '#dbcf98', layers: [fur(0.08)], shading: 0.05 });
export const crate = () => ({
  base: '#a8753f',
  layers: [(c, { i, j, fw, fh }) => (i === 0 || j === 0 || i === fw - 1 || j === fh - 1 || i === j ? shade(c, 0.7) : c), fur(0.05)],
});

/** The materials every machine shares; machines add their own paint colours. */
export function commonMaterials(main, { second = PALETTE.dark, mudTo = 8 } = {}) {
  return {
    paint: paint(main, { mudTo }),
    paint2: paint(second),
    stripe: hazard(),
    metal: metal(),
    dark: metal('#3a3d40'),
    chrome: chrome(),
    rubber: rubber(),
    tyre: tyre(),
    track: track(),
    glass: glass(),
    frame: metal('#202224'),
    seat: seat(),
    lamp: lamp(),
    beacon: lamp('#ff9a1f'),
    tail: lamp('#c4231b'),
    soil: soil(),
    rock: rock(),
    sand: sand(),
    crate: crate(),
    ballast: paint('#8e8d88', { wearAmount: 0.2 }),
  };
}
