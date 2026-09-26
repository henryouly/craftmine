import { meshChunk } from '../src/voxel/mesher';
import { VoxelStore } from '../src/voxel/store';
import { describe, it, expect } from 'vitest';

// single solid cube -> 6 quads = 12 tris = 24 verts
describe('mesher', () => {
  it('single cube 6 faces', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(8, 8, 8, 3);
    const g = meshChunk(s, 0, 0);
    expect(g.index!.count).toBe(36);
  });
  it('hidden faces culled', () => {
    const s = new VoxelStore(16, 16, 16);
    s.set(8, 8, 8, 3);
    s.set(9, 8, 8, 3);
    const g = meshChunk(s, 0, 0);
    expect(g.index!.count).toBeLessThan(72);
  });
});
