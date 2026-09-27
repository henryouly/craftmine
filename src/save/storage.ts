/** Save system: localStorage diff snapshots + Export/Import JSON. */

import { VoxelStore } from '../voxel/store';
import { generate } from '../voxel/worldgen';

export const SAVE_KEY = 'craftmine-v1';
export const BACKUP_KEY = 'craftmine-bak';

export interface SaveData {
  seed: number;
  /** Sparse voxel diff: linear buffer index (as string) -> block id. */
  diff: Record<string, number>;
  /** Day/night clock in [0,1). Optional for backward compatibility. */
  time?: number;
}

/** Byte-compare base vs edited; every differing cell becomes a diff entry. */
export function collectDiff(base: VoxelStore, edited: VoxelStore): Record<string, number> {
  const diff: Record<string, number> = {};
  const n = Math.min(base.data.length, edited.data.length);
  for (let i = 0; i < n; i++) {
    if (base.data[i] !== edited.data[i]) diff[String(i)] = edited.data[i];
  }
  return diff;
}

/** Apply a diff onto a store in place (bounds-checked, ignores junk keys). */
export function applyDiff(store: VoxelStore, diff: Record<string, number>): void {
  for (const key of Object.keys(diff)) {
    const i = Number(key);
    const id = diff[key];
    if (!Number.isInteger(i) || i < 0 || i >= store.data.length) continue;
    if (!Number.isInteger(id) || id < 0 || id > 255) continue;
    store.data[i] = id;
  }
}

/** Pure parser: returns null for corrupt/invalid saves (never throws). */
export function parseSave(text: string): SaveData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { seed, diff, time } = raw as { seed?: unknown; diff?: unknown; time?: unknown };
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return null;
  if (typeof diff !== 'object' || diff === null) return null;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(diff as Record<string, unknown>)) {
    if (k === '' || !Number.isInteger(Number(k)) || Number(k) < 0) return null;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 255) return null;
    clean[k] = v;
  }
  let cleanTime: number | undefined;
  if (time !== undefined) {
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time >= 1) {
      return null;
    }
    cleanTime = time;
  }
  return cleanTime === undefined
    ? { seed: Math.floor(seed), diff: clean }
    : { seed: Math.floor(seed), diff: clean, time: cleanTime };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Persist the world. Diff is computed against `base` (a pristine
 * generate(seed) snapshot) when provided; otherwise a fresh generate(seed)
 * is used (~60ms, fine on a 1s debounce).
 */
export function saveGame(
  seed: number,
  edited: VoxelStore,
  base?: VoxelStore,
  time?: number,
): void {
  const store = storage();
  if (!store) return;
  try {
    const ref = base ?? generate(seed);
    const data: SaveData =
      time === undefined
        ? { seed, diff: collectDiff(ref, edited) }
        : { seed, diff: collectDiff(ref, edited), time };
    store.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full/unavailable: game continues without persistence.
  }
}

/**
 * Load a save, or null when missing/unusable. Corrupt JSON is backed up to
 * BACKUP_KEY and cleared so the next boot regenerates cleanly.
 */
export function loadGame(): SaveData | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const parsed = parseSave(raw);
  if (!parsed) {
    try {
      store.setItem(BACKUP_KEY, raw);
      store.removeItem(SAVE_KEY);
    } catch {
      // Best effort; a broken store should never crash boot.
    }
    return null;
  }
  return parsed;
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
