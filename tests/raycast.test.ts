import { describe, it, expect } from 'vitest';
import { VoxelStore } from '../src/voxel/store';
import { raycastVoxel } from '../src/player/raycast';

describe('raycastVoxel (Amanatides & Woo DDA)', () => {
  it('hits wall in front', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(5, 8, 8, 3);
    const hit = raycastVoxel(
      s,
      { x: 0.5, y: 8.5, z: 8.5 },
      { x: 1, y: 0, z: 0 },
      8,
    );
    expect(hit).not.toBeNull();
    expect(hit!.x).toBe(5);
    expect(hit!.y).toBe(8);
    expect(hit!.z).toBe(8);
  });

  it('returns null looking at sky', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(5, 8, 8, 3);
    // Empty column above; zero x/z components must not hang (Infinity tDelta).
    const hit = raycastVoxel(
      s,
      { x: 0.5, y: 8.5, z: 8.5 },
      { x: 0, y: 1, z: 0 },
      8,
    );
    expect(hit).toBeNull();
  });

  it('normal points back toward origin', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(5, 8, 8, 3);
    const dir = { x: 1, y: 0, z: 0 };
    const hit = raycastVoxel(s, { x: 0.5, y: 8.5, z: 8.5 }, dir, 8);
    expect(hit).not.toBeNull();
    // Face normal opposes the ray direction.
    const dot = dir.x * hit!.nx + dir.y * hit!.ny + dir.z * hit!.nz;
    expect(dot).toBeLessThan(0);
    expect([hit!.nx, hit!.ny, hit!.nz]).toEqual([-1, 0, 0]);
  });

  it('returns null beyond maxDist', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(10, 8, 8, 3);
    const hit = raycastVoxel(
      s,
      { x: 0.5, y: 8.5, z: 8.5 },
      { x: 1, y: 0, z: 0 },
      8,
    );
    expect(hit).toBeNull();
  });
});
