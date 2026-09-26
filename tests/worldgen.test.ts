import { generate } from '../src/voxel/worldgen';
import { describe, it, expect } from 'vitest';

describe('worldgen', () => {
  it('deterministic', () => {
    const a = generate(42);
    const b = generate(42);
    expect(a.get(64, 20, 64)).toBe(b.get(64, 20, 64));
  });
  it('has grass + bedrock', () => {
    const s = generate(1);
    let grass = false;
    let bed = false;
    for (let x = 60; x < 70; x++)
      for (let z = 60; z < 70; z++)
        for (let y = 0; y < 48; y++) {
          const v = s.get(x, y, z);
          if (v === 1) grass = true;
          if (v === 10) bed = true;
        }
    expect(grass && bed).toBe(true);
  });
});
