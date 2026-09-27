import { describe, it, expect } from 'vitest';
import { generate } from '../src/voxel/worldgen';
import { collectDiff, applyDiff, parseSave } from '../src/save/storage';

describe('storage diff roundtrip', () => {
  it('empty diff when nothing edited', () => {
    const a = generate(42);
    const b = generate(42);
    expect(collectDiff(a, b)).toEqual({});
  });

  it('preserves edits through collect -> fresh generate -> apply', () => {
    const seed = 7;
    const base = generate(seed);
    const edited = generate(seed);
    edited.set(10, 20, 10, 9);
    edited.set(11, 20, 10, 0);
    edited.set(64, 30, 64, 8);

    const diff = collectDiff(base, edited);
    expect(Object.keys(diff)).toHaveLength(3);

    const fresh = generate(seed);
    applyDiff(fresh, diff);
    expect(fresh.data).toEqual(edited.data);
  });

  it('ignores out-of-range and non-integer entries', () => {
    const s = generate(1);
    const before = s.data.slice();
    applyDiff(s, { '-1': 5, '999999999': 5, '10.5': 3 } as unknown as Record<string, number>);
    expect(s.data).toEqual(before);
  });
});

describe('parseSave', () => {
  it('round-trips valid JSON', () => {
    const parsed = parseSave(JSON.stringify({ seed: 42, diff: { '10': 9, '11': 0 } }));
    expect(parsed).toEqual({ seed: 42, diff: { '10': 9, '11': 0 } });
  });

  it('returns null for corrupt JSON', () => {
    expect(parseSave('not json{{{')).toBeNull();
    expect(parseSave('')).toBeNull();
  });

  it('returns null for wrong shapes', () => {
    expect(parseSave('null')).toBeNull();
    expect(parseSave('[1,2]')).toBeNull();
    expect(parseSave(JSON.stringify({ seed: 'x', diff: {} }))).toBeNull();
    expect(parseSave(JSON.stringify({ seed: 1 }))).toBeNull();
    expect(parseSave(JSON.stringify({ seed: 1, diff: { '5': 'brick' } }))).toBeNull();
    expect(parseSave(JSON.stringify({ seed: 1, diff: { '5': 999 } }))).toBeNull();
  });

  it('roundtrips optional clock time', () => {
    expect(parseSave(JSON.stringify({ seed: 1, diff: {}, time: 0.5 }))?.time).toBe(0.5);
    expect(parseSave(JSON.stringify({ seed: 1, diff: {} }))?.time).toBeUndefined();
    expect(parseSave(JSON.stringify({ seed: 1, diff: {}, time: 1.5 }))).toBeNull();
    expect(parseSave(JSON.stringify({ seed: 1, diff: {}, time: 'noon' }))).toBeNull();
  });
});
