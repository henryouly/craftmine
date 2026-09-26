import { VoxelStore } from '../src/voxel/store';
import { describe, it, expect } from 'vitest';

describe('store', () => {
  it('set/get roundtrip', () => {
    const s = new VoxelStore(32, 16, 32);
    s.set(1, 2, 3, 5);
    expect(s.get(1, 2, 3)).toBe(5);
  });
  it('oob returns 0', () => {
    const s = new VoxelStore(32, 16, 32);
    expect(s.get(-1, 0, 0)).toBe(0);
  });
  it('marks chunk dirty', () => {
    const s = new VoxelStore(128, 48, 128);
    const f: string[] = [];
    s.onDirty = (c) => f.push(c);
    s.set(17, 10, 5, 1);
    expect(f).toContain('1,0');
  });
});
