import { describe, it, expect } from 'vitest';
import { moonElevation, starAlpha, sunElevation } from '../src/world/daynight';

describe('sky', () => {
  it('moon opposes the sun through the whole dial', () => {
    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      expect(moonElevation(t)).toBeCloseTo(-sunElevation(t), 10);
    }
    expect(moonElevation(0.75)).toBeCloseTo(1); // full moon at midnight
    expect(moonElevation(0.25)).toBeCloseTo(-1);
  });

  it('stars only at night', () => {
    expect(starAlpha(0.25)).toBe(0); // noon
    expect(starAlpha(0.75)).toBe(1); // midnight
    expect(starAlpha(0)).toBeLessThan(1); // sunrise, fading
    expect(starAlpha(0.1)).toBe(0); // morning, out
    for (let i = 0; i < 24; i++) {
      const a = starAlpha(i / 24);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(Number.isNaN(a)).toBe(false);
    }
  });
});
