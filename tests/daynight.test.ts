import { describe, it, expect } from 'vitest';
import {
  advanceTime,
  daylight,
  formatTime,
  normalizeTime,
  sampleDayNight,
  skyColor,
  sunElevation,
} from '../src/world/daynight';

describe('daynight', () => {
  it('normalizes and wraps', () => {
    expect(normalizeTime(1.25)).toBeCloseTo(0.25);
    expect(normalizeTime(-0.1)).toBeCloseTo(0.9);
    expect(advanceTime(0.9, 600_000 * 0.2)).toBeCloseTo(0.1);
    expect(advanceTime(0.5, -100)).toBe(0.5);
  });

  it('noon brightest, midnight darkest', () => {
    expect(sunElevation(0.25)).toBeCloseTo(1);
    expect(sunElevation(0.75)).toBeCloseTo(-1);
    const noon = sampleDayNight(0.25);
    const mid = sampleDayNight(0.75);
    expect(noon.sunIntensity).toBeGreaterThan(mid.sunIntensity);
    expect(noon.hemiIntensity).toBeGreaterThan(mid.hemiIntensity);
    expect(noon.daylight).toBe(1);
    expect(mid.daylight).toBe(0);
    expect(daylight(0.25)).toBe(1);
  });

  it('sky colors valid and vary across the day', () => {
    const noon = skyColor(0.25);
    const night = skyColor(0.75);
    for (const c of [...noon, ...night]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    }
    expect(noon).not.toEqual(night);
    // Vanilla values: plains noon #78A7FF, midnight pure black.
    expect(noon.map(Math.round)).toEqual([120, 167, 255]);
    expect(night.map(Math.round)).toEqual([0, 0, 0]);
    // No NaNs anywhere on the dial.
    for (let i = 0; i < 24; i++) {
      const s = sampleDayNight(i / 24);
      expect([...s.sky, ...s.sunColor]).toHaveLength(6);
      for (const v of [...s.sky, ...s.sunColor]) expect(Number.isNaN(v)).toBe(false);
    }
  });

  it('formats clock labels', () => {
    expect(formatTime(0)).toBe('06:00');
    expect(formatTime(0.25)).toBe('12:00');
    expect(formatTime(0.5)).toBe('18:00');
    expect(formatTime(0.75)).toBe('00:00');
  });
});
