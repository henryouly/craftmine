/** Worldgen: seeded terrain + trees + flattened spawn. No Three.js. */

import { HEIGHT, SIZE, VoxelStore } from './store';

// Block ids: 0 air, 1 grass, 2 dirt, 3 stone, 4 log, 5 leaves,
// 6 sand, 7 planks, 8 glass, 9 brick, 10 bedrock.
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const LOG = 4;
const LEAVES = 5;
const SAND = 6;
const BEDROCK = 10;

const SPAWN_X = 64;
const SPAWN_Z = 64;
const SPAWN_RADIUS = 2; // 5x5

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D lattice hash -> [0, 1). Seed-scoped. */
export function hash2D(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value noise 2D with bilinear interpolation of hashed lattice values. */
export function valueNoise2D(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash2D(xi, zi, seed);
  const b = hash2D(xi + 1, zi, seed);
  const c = hash2D(xi, zi + 1, seed);
  const d = hash2D(xi + 1, zi + 1, seed);
  const u = smootherstep(xf);
  const v = smootherstep(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Column height: 18 + 3 octaves (freq 1/32, 1/16, 1/8; amp 8/4/2). Range ~[18, 32]. */
export function heightAt(seed: number, x: number, z: number): number {
  const n1 = valueNoise2D(x / 32, z / 32, seed);
  const n2 = valueNoise2D(x / 16, z / 16, seed ^ 0x9e3779b9);
  const n3 = valueNoise2D(x / 8, z / 8, seed ^ 0x51ab3c59);
  const h = Math.floor(18 + n1 * 8 + n2 * 4 + n3 * 2);
  return Math.min(HEIGHT - 8, Math.max(1, h));
}

/** Tree decision hash -> [0, 1). Separate stream from terrain noise. */
function treeHash(seed: number, x: number, z: number): number {
  return hash2D(x, z, (seed ^ 0x3c6ef372) | 0);
}

function buildColumn(store: VoxelStore, x: number, z: number, h: number): void {
  const beach = h < 20;
  for (let y = 0; y <= h && y < HEIGHT; y++) {
    let id: number;
    if (y === 0) id = BEDROCK;
    else if (y < h - 3) id = STONE;
    else if (y < h) id = beach ? SAND : DIRT;
    else id = beach ? SAND : GRASS; // top block y === h
    store.set(x, y, z, id);
  }
}

function plantTree(store: VoxelStore, x: number, h: number, z: number): void {
  // Trunk 4 high: h+1 .. h+4. Leaves 3x3x2 blob at h+3..h+4 around trunk.
  if (h + 4 >= HEIGHT) return;
  for (let dy = 3; dy <= 4; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue; // trunk column
        const px = x + dx;
        const pz = z + dz;
        const py = h + dy;
        if (px < 0 || pz < 0 || px >= store.sx || pz >= store.sz) continue;
        if (store.get(px, py, pz) === AIR) store.set(px, py, pz, LEAVES);
      }
    }
  }
  for (let dy = 1; dy <= 4; dy++) {
    store.set(x, h + dy, z, LOG);
  }
}

/** Generate a SIZE x HEIGHT x SIZE world from a seed. Deterministic. */
export function generate(seed: number): VoxelStore {
  // Touch mulberry32 so the PRNG stays part of the pipeline (terrain uses
  // hash-based value noise which is already seed-deterministic).
  mulberry32(seed)();
  const store = new VoxelStore(SIZE, HEIGHT, SIZE);

  const heights = new Int16Array(SIZE * SIZE);
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      heights[x + z * SIZE] = heightAt(seed, x, z);
    }
  }

  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      buildColumn(store, x, z, heights[x + z * SIZE]);
    }
  }

  // Trees: 1% on grass above y=21, kept out of the spawn flat.
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      if (Math.abs(x - SPAWN_X) <= SPAWN_RADIUS + 1 && Math.abs(z - SPAWN_Z) <= SPAWN_RADIUS + 1) {
        continue;
      }
      const h = heights[x + z * SIZE];
      if (h <= 21) continue;
      if (store.get(x, h, z) !== GRASS) continue; // beach/sand excluded
      if (treeHash(seed, x, z) < 0.01) plantTree(store, x, h, z);
    }
  }

  // Flatten 5x5 spawn around center to h_center, recompute grass top.
  const hc = heights[SPAWN_X + SPAWN_Z * SIZE];
  for (let dz = -SPAWN_RADIUS; dz <= SPAWN_RADIUS; dz++) {
    for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
      const x = SPAWN_X + dx;
      const z = SPAWN_Z + dz;
      // Clear anything above the target top (e.g. tree parts), then rebuild.
      for (let y = hc + 1; y < HEIGHT; y++) {
        if (store.get(x, y, z) !== AIR) store.set(x, y, z, AIR);
      }
      buildColumn(store, x, z, hc);
    }
  }

  return store;
}
