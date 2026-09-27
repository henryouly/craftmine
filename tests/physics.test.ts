import { describe, it, expect } from 'vitest';
import { VoxelStore } from '../src/voxel/store';
import { collide, HALF_WIDTH, PLAYER_HEIGHT } from '../src/player/physics';

describe('collide', () => {
  it('wall stops horizontal motion', () => {
    const s = new VoxelStore(16, 16, 16);
    // Solid column at x=8 spanning the player's height.
    s.set(8, 1, 8, 3);
    s.set(8, 2, 8, 3);
    const r = collide(
      s,
      { x: 6.5, y: 1, z: 8.5 },
      { x: 5, y: 0, z: 0 },
      0.3,
    );
    expect(r.pos.x + HALF_WIDTH).toBeLessThanOrEqual(8.001);
    expect(r.vel.x).toBe(0);
    expect(r.onGround).toBe(false);
  });

  it('lands on ground slab', () => {
    const s = new VoxelStore(16, 16, 16);
    for (let x = 0; x < 16; x++)
      for (let z = 0; z < 16; z++) s.set(x, 0, z, 3);
    const r = collide(
      s,
      { x: 8.5, y: 5, z: 8.5 },
      { x: 0, y: -10, z: 0 },
      0.5,
    );
    expect(r.onGround).toBe(true);
    expect(r.vel.y).toBe(0);
    expect(r.pos.y).toBeCloseTo(1, 3);
  });

  it('head bump blocks upward motion', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(8, 5, 8, 3); // ceiling block
    const r = collide(
      s,
      { x: 8.5, y: 3, z: 8.5 },
      { x: 0, y: 8.5, z: 0 },
      0.1,
    );
    expect(r.vel.y).toBe(0);
    expect(r.pos.y + PLAYER_HEIGHT).toBeLessThanOrEqual(5.001);
    expect(r.onGround).toBe(false);
  });

  it('world edges act as walls on x', () => {
    const s = new VoxelStore(16, 16, 16);
    const r = collide(s, { x: 15.5, y: 5, z: 8.5 }, { x: 12, y: 0, z: 0 }, 0.5);
    expect(r.pos.x).toBeLessThanOrEqual(16 - HALF_WIDTH + 1e-6);
    expect(r.vel.x).toBe(0);
  });

  it('world edges act as walls on z', () => {
    const s = new VoxelStore(16, 16, 16);
    const r = collide(s, { x: 8.5, y: 5, z: 0.5 }, { x: 0, y: 0, z: -12 }, 0.5);
    expect(r.pos.z).toBeGreaterThanOrEqual(HALF_WIDTH - 1e-6);
    expect(r.vel.z).toBe(0);
  });
});
