import { describe, it, expect } from 'vitest';
import { tileUV, getTileForBlock, TILES } from '../src/voxel/atlas';

describe('atlas', () => {
  it('tileUV in range', () => {
    const [u0, v0, u1, v1] = tileUV(0, 16);
    expect(u0).toBeGreaterThanOrEqual(0);
    expect(v0).toBeGreaterThanOrEqual(0);
    expect(u1).toBeLessThanOrEqual(1);
    expect(v1).toBeLessThanOrEqual(1);
  });

  it('all tiles within [0,1] with u0<u1, v0<v1', () => {
    for (let i = 0; i < 16; i++) {
      const [u0, v0, u1, v1] = tileUV(i, 16);
      expect(u0).toBeGreaterThanOrEqual(0);
      expect(v0).toBeGreaterThanOrEqual(0);
      expect(u1).toBeLessThanOrEqual(1);
      expect(v1).toBeLessThanOrEqual(1);
      expect(u1).toBeGreaterThan(u0);
      expect(v1).toBeGreaterThan(v0);
    }
  });

  it('grass top vs side distinction', () => {
    expect(getTileForBlock(1, 'top')).toBe(TILES.grass_top);
    expect(getTileForBlock(1, 'side')).toBe(TILES.grass_side);
    expect(getTileForBlock(1, 'bottom')).toBe(TILES.dirt);
    expect(getTileForBlock(1, 'top')).not.toBe(getTileForBlock(1, 'side'));
  });
});
