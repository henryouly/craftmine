/** Voxel DDA raycast (Amanatides & Woo). Pure — no Three.js. */

import type { VoxelStore } from '../voxel/store';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface Hit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

interface SolidLike {
  isSolid(x: number, y: number, z: number): boolean;
}

/**
 * Cast a ray through solid voxels, returning the first hit cell plus the
 * face normal pointing back toward the origin. `dir` should be normalized
 * (so `maxDist` is in world units); zero components are handled via
 * Infinity step deltas. Returns null when nothing solid is within maxDist.
 */
export function raycastVoxel(
  store: VoxelStore | SolidLike,
  origin: Vec3Like,
  dir: Vec3Like,
  maxDist = 8,
): Hit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX =
    stepX === 0
      ? Infinity
      : stepX > 0
        ? (x + 1 - origin.x) / dir.x
        : (origin.x - x) / -dir.x;
  let tMaxY =
    stepY === 0
      ? Infinity
      : stepY > 0
        ? (y + 1 - origin.y) / dir.y
        : (origin.y - y) / -dir.y;
  let tMaxZ =
    stepZ === 0
      ? Infinity
      : stepZ > 0
        ? (z + 1 - origin.z) / dir.z
        : (origin.z - z) / -dir.z;

  // Origin inside a solid voxel: report it with a zero normal.
  if (store.isSolid(x, y, z)) {
    return { x, y, z, nx: 0, ny: 0, nz: 0 };
  }

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // Bound iterations: worst case ~3 steps per unit distance.
  const maxIter = Math.ceil(maxDist * 3) + 8;
  for (let i = 0; i < maxIter; i++) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if (t > maxDist) return null;
    if (store.isSolid(x, y, z)) {
      return { x, y, z, nx, ny, nz };
    }
  }
  return null;
}
