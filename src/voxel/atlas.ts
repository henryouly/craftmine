import * as THREE from 'three';

/** Tile indices into the 4x4 atlas grid (16px tiles on a 64x64 canvas). */
export const TILES = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  log: 4,
  leaves: 5,
  sand: 6,
  planks: 7,
  glass: 8,
  brick: 9,
  bedrock: 10,
  log_top: 11,
} as const;

export type TileName = keyof typeof TILES;
export type BlockFace = 'top' | 'bottom' | 'side';

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;
export const TILE_SIZE = 16;
export const ATLAS_SIZE = 64; // ATLAS_COLS * TILE_SIZE
export const TILE_COUNT = 16;

/**
 * UV rect for tile `i` in `[0,1]`, corrected for CanvasTexture flipY
 * so it can be used directly in BufferGeometry uv attributes.
 * Returns [u0, v0, u1, v1] with u0<u1, v0<v1.
 */
export function tileUV(i: number, count = TILE_COUNT): [number, number, number, number] {
  const cols = ATLAS_COLS;
  const rows = Math.ceil(count / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const u0 = col / cols;
  const u1 = (col + 1) / cols;
  // Canvas row 0 is the top; flipY=true means v=1 is the top.
  const v1 = 1 - row / rows;
  const v0 = 1 - (row + 1) / rows;
  return [u0, v0, u1, v1];
}

/** Map a block id + face to a tile index. Block ids: 0=air,1=grass,...,10=bedrock. */
export function getTileForBlock(blockId: number, face: BlockFace): number {
  switch (blockId) {
    case 1: // grass
      if (face === 'top') return TILES.grass_top;
      if (face === 'bottom') return TILES.dirt;
      return TILES.grass_side;
    case 2:
      return TILES.dirt;
    case 3:
      return TILES.stone;
    case 4: // log: bark on side, rings on top/bottom
      return face === 'side' ? TILES.log : TILES.log_top;
    case 5:
      return TILES.leaves;
    case 6:
      return TILES.sand;
    case 7:
      return TILES.planks;
    case 8:
      return TILES.glass;
    case 9:
      return TILES.brick;
    case 10:
      return TILES.bedrock;
    default:
      return TILES.dirt;
  }
}

// --- Procedural pixel-art painting ---

type RGB = [number, number, number];

/** Deterministic per-tile PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade([r, g, b]: RGB, f: number): string {
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function paintTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  fn: (x: number, y: number, rand: () => number) => string | null,
): void {
  const ox = (tile % ATLAS_COLS) * TILE_SIZE;
  const oy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE;
  const rand = rng(tile * 1000 + 7);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const c = fn(x, y, rand);
      if (c === null) continue; // leave transparent (glass/leaves holes)
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function noisy(base: RGB, amount: number): (x: number, y: number, rand: () => number) => string {
  return (_x, _y, rand) => shade(base, 1 + (rand() * 2 - 1) * amount);
}

/** Procedural 64x64 atlas texture: 16x16px pixel-art tiles, crisp pixels. */
export function makeAtlasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');

  // Clear to transparent so glass/leaves cutouts work with alphaTest.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Unused tiles 12-15: flat gray so OOB tiles are visible but harmless.
  // (Tile 11 is log_top, painted from the real pack or procedurally below.)
  for (let t = 12; t < 16; t++) {
    paintTile(ctx, t, noisy([140, 140, 140], 0.05));
  }

  const GRASS: RGB = [95, 174, 63];
  const DIRT: RGB = [134, 95, 60];
  const STONE: RGB = [141, 141, 141];
  const SAND: RGB = [219, 207, 163];
  const LOG: RGB = [104, 78, 47];
  const LEAF: RGB = [46, 140, 46];
  const PLANK: RGB = [168, 132, 72];
  const BRICK: RGB = [155, 72, 60];
  const BEDROCK: RGB = [60, 60, 60];

  paintTile(ctx, TILES.grass_top, noisy(GRASS, 0.12));
  paintTile(ctx, TILES.dirt, noisy(DIRT, 0.14));
  paintTile(ctx, TILES.stone, noisy(STONE, 0.08));
  paintTile(ctx, TILES.sand, noisy(SAND, 0.06));

  // grass_side: dirt body + 3-4px grass cap with jagged edge
  paintTile(ctx, TILES.grass_side, (_x, y, rand) => {
    const edge = 3 + Math.floor(rand() * 2);
    if (y <= edge) return shade(GRASS, 1 + (rand() * 2 - 1) * 0.12);
    return shade(DIRT, 1 + (rand() * 2 - 1) * 0.14);
  });

  // log: vertical bark stripes
  paintTile(ctx, TILES.log, (x, _y, rand) => {
    const stripe = x % 4 === 0 ? 0.72 : 1 + (rand() * 2 - 1) * 0.08;
    return shade(LOG, stripe);
  });

  // log_top: concentric rings (procedural fallback)
  paintTile(ctx, TILES.log_top, (x, y, rand) => {
    const dx = Math.abs(x - 7.5);
    const dy = Math.abs(y - 7.5);
    const ring = Math.max(dx, dy) % 2 === 0 ? 1 : 0.78;
    void rand;
    return shade(LOG, ring);
  });

  // leaves: dense green with sparse transparent holes for alphaTest cutout
  paintTile(ctx, TILES.leaves, (_x, _y, rand) => {
    const r = rand();
    if (r < 0.08) return null;
    return shade(LEAF, r < 0.3 ? 0.7 : 1 + (rand() * 2 - 1) * 0.15);
  });

  // planks: horizontal boards every 4px with dark seams + nail dots
  paintTile(ctx, TILES.planks, (x, y, rand) => {
    if (y % 4 === 3) return shade(PLANK, 0.62);
    let f = 1 + (rand() * 2 - 1) * 0.07;
    if ((x === 3 || x === 12) && y % 4 === 1) f = 0.6; // nails
    return shade(PLANK, f);
  });

  // glass: transparent center, white frame + light-blue streak
  paintTile(ctx, TILES.glass, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return 'rgb(225,240,245)';
    if (x === y || (x === 4 && y > 8) || (x === 5 && y > 8)) return 'rgb(220,238,244)';
    return null;
  });

  // brick: 4px-tall courses with 8px offset every other row, mortar seams
  paintTile(ctx, TILES.brick, (x, y, rand) => {
    const row = Math.floor(y / 4);
    const mortarY = y % 4 === 3;
    const mortarX = row % 2 === 0 ? x % 8 === 7 : x % 8 === 3;
    if (mortarY || mortarX) return 'rgb(188,178,170)';
    return shade(BRICK, 1 + (rand() * 2 - 1) * 0.1);
  });

  // bedrock: high-contrast dark noise
  paintTile(ctx, TILES.bedrock, (_x, _y, rand) => shade(BEDROCK, 1 + (rand() * 2 - 1) * 0.45));

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Real texture pack (assets/minecraft/textures/block/) ---

/** Tile index -> source PNG in the user-supplied pack. Bundled by Vite via new URL(). */
const PACK_SOURCES: Record<number, string> = {
  [TILES.grass_top]: new URL(
    '../../assets/minecraft/textures/block/grass_block_top.png',
    import.meta.url,
  ).href,
  [TILES.grass_side]: new URL(
    '../../assets/minecraft/textures/block/grass_block_side.png',
    import.meta.url,
  ).href,
  [TILES.dirt]: new URL('../../assets/minecraft/textures/block/dirt.png', import.meta.url).href,
  [TILES.stone]: new URL('../../assets/minecraft/textures/block/stone.png', import.meta.url).href,
  [TILES.log]: new URL('../../assets/minecraft/textures/block/oak_log.png', import.meta.url).href,
  [TILES.log_top]: new URL(
    '../../assets/minecraft/textures/block/oak_log_top.png',
    import.meta.url,
  ).href,
  [TILES.leaves]: new URL(
    '../../assets/minecraft/textures/block/oak_leaves.png',
    import.meta.url,
  ).href,
  [TILES.sand]: new URL('../../assets/minecraft/textures/block/sand.png', import.meta.url).href,
  [TILES.planks]: new URL(
    '../../assets/minecraft/textures/block/oak_planks.png',
    import.meta.url,
  ).href,
  [TILES.glass]: new URL('../../assets/minecraft/textures/block/glass.png', import.meta.url).href,
  [TILES.brick]: new URL('../../assets/minecraft/textures/block/bricks.png', import.meta.url).href,
  [TILES.bedrock]: new URL('../../assets/minecraft/textures/block/bedrock.png', import.meta.url)
    .href,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

// Vanilla grass/leaves textures ship grayscale; the game tints them per-biome.
// We bake the plains tint (#91BD59) into the atlas at load.
const GRASS_TINT: RGB = [145, 189, 89];

function tintTile(ctx: CanvasRenderingContext2D, tile: number, tint: RGB): void {
  const ox = (tile % ATLAS_COLS) * TILE_SIZE;
  const oy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE;
  const img = ctx.getImageData(ox, oy, TILE_SIZE, TILE_SIZE);
  const d = img.data;
  const [tr, tg, tb] = tint;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // keep cutout holes transparent
    d[i] = Math.round((d[i] / 255) * tr);
    d[i + 1] = Math.round((d[i + 1] / 255) * tg);
    d[i + 2] = Math.round((d[i + 2] / 255) * tb);
  }
  ctx.putImageData(img, ox, oy);
}

/**
 * Build the atlas canvas from the real texture pack PNGs.
 * Each source is drawn scaled to 16x16 into its tile slot.
 * Throws if any PNG fails to load (caller should fall back).
 */
export async function makeAtlasTextureFromPack(): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  await Promise.all(
    Object.entries(PACK_SOURCES).map(async ([tileStr, src]) => {
      const tile = Number(tileStr);
      const img = await loadImage(src);
      const ox = (tile % ATLAS_COLS) * TILE_SIZE;
      const oy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE;
      ctx.drawImage(img, ox, oy, TILE_SIZE, TILE_SIZE);
    }),
  );

  // grass_block_top.png and oak_leaves.png are grayscale in the pack;
  // tint them (grass_block_side.png already ships pre-tinted).
  tintTile(ctx, TILES.grass_top, GRASS_TINT);
  tintTile(ctx, TILES.leaves, GRASS_TINT);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Try the real pack first, fall back to the procedural atlas on any error.
 * Use this in game boot so a missing/partial pack never breaks rendering.
 */
export async function loadAtlasTexture(): Promise<THREE.CanvasTexture> {
  try {
    return await makeAtlasTextureFromPack();
  } catch {
    return makeAtlasTexture();
  }
}
