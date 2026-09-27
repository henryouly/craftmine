/** Player physics: pure AABB-vs-voxel collision. No Three.js. */

import type { VoxelStore } from '../voxel/store';

export const HALF_WIDTH = 0.3;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
export const GRAVITY = 25;
export const JUMP_VELOCITY = 8.5;
export const WALK_SPEED = 5;
export const SPRINT_SPEED = 8;
export const FLY_SPEED = 12;

/** Scan epsilon: a max edge exactly on a voxel boundary must not count the neighbor. */
const SCAN_EPS = 1e-9;
/** Resolve epsilon: keep the AABB a hair off the blocking face so the next frame starts clean. */
const RESOLVE_EPS = 1e-4;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CollideResult {
  pos: Vec3Like;
  vel: Vec3Like;
  onGround: boolean;
}

function overlaps(
  store: VoxelStore,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  const x0 = Math.floor(minX);
  const x1 = Math.floor(maxX - SCAN_EPS);
  const y0 = Math.floor(minY);
  const y1 = Math.floor(maxY - SCAN_EPS);
  const z0 = Math.floor(minZ);
  const z1 = Math.floor(maxZ - SCAN_EPS);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        if (store.isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

/**
 * Move an AABB (feet-centered `pos`, half-width `halfW`, `height`) by
 * `vel * dt`, resolving per axis (x, then y, then z) against solid voxels.
 * Gravity is applied by the caller. Returns fresh pos/vel plus onGround.
 */
export function collide(
  store: VoxelStore,
  pos: Vec3Like,
  vel: Vec3Like,
  dt: number,
  halfW = HALF_WIDTH,
  height = PLAYER_HEIGHT,
): CollideResult {
  let px = pos.x;
  let py = pos.y;
  let pz = pos.z;
  let vx = vel.x;
  let vy = vel.y;
  let vz = vel.z;
  let onGround = false;

  const collidesAt = (x: number, y: number, z: number): boolean =>
    overlaps(store, x - halfW, y, z - halfW, x + halfW, y + height, z + halfW);

  // X axis
  px += vx * dt;
  if (vx !== 0 && collidesAt(px, py, pz)) {
    if (vx > 0) {
      px = Math.floor(px + halfW - SCAN_EPS) - halfW - RESOLVE_EPS;
    } else {
      px = Math.floor(px - halfW) + 1 + halfW + RESOLVE_EPS;
    }
    vx = 0;
  }

  // Y axis
  py += vy * dt;
  if (vy !== 0 && collidesAt(px, py, pz)) {
    if (vy < 0) {
      py = Math.floor(py) + 1;
      onGround = true;
    } else {
      py = Math.floor(py + height - SCAN_EPS) - height - RESOLVE_EPS;
    }
    vy = 0;
  }

  // Z axis
  pz += vz * dt;
  if (vz !== 0 && collidesAt(px, py, pz)) {
    if (vz > 0) {
      pz = Math.floor(pz + halfW - SCAN_EPS) - halfW - RESOLVE_EPS;
    } else {
      pz = Math.floor(pz - halfW) + 1 + halfW + RESOLVE_EPS;
    }
    vz = 0;
  }

  // World-edge walls: keep the AABB on the plane (walk + fly).
  const minX = halfW;
  const maxX = store.sx - halfW;
  if (px < minX) {
    px = minX;
    vx = 0;
  } else if (px > maxX) {
    px = maxX;
    vx = 0;
  }
  const minZ = halfW;
  const maxZ = store.sz - halfW;
  if (pz < minZ) {
    pz = minZ;
    vz = 0;
  } else if (pz > maxZ) {
    pz = maxZ;
    vz = 0;
  }

  return {
    pos: { x: px, y: py, z: pz },
    vel: { x: vx, y: vy, z: vz },
    onGround,
  };
}
