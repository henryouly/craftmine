/** Day/night cycle: pure time-of-day sampler (no Three.js dependency). */

export const DAY_LENGTH_MS = 600_000; // 10-minute MC-like cycle

/** timeOfDay in [0,1): 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight. */
export function normalizeTime(t: number): number {
  if (!Number.isFinite(t)) return 0.1;
  return ((t % 1) + 1) % 1;
}

/** Advance the clock by dtMs, wrapping around midnight. */
export function advanceTime(t: number, dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs < 0) return normalizeTime(t);
  return normalizeTime(normalizeTime(t) + dtMs / DAY_LENGTH_MS);
}

/** Sun elevation: +1 at noon, -1 at midnight, 0 at rise/set. */
export function sunElevation(t: number): number {
  return Math.cos((normalizeTime(t) - 0.25) * Math.PI * 2);
}

/** Daylight factor 0..1, with a soft band around the horizon. */
export function daylight(t: number): number {
  const e = sunElevation(t);
  return Math.min(1, Math.max(0, e * 1.5 + 0.25));
}

export type RGB = [number, number, number];

/** Keyframed sky colors (0-255). */
const SKY_KEYS: Array<[number, RGB]> = [
  [0.0, [217, 160, 107]], // sunrise
  [0.08, [135, 206, 235]], // morning -> noon blue
  [0.25, [135, 206, 235]], // noon
  [0.42, [135, 206, 235]], // afternoon
  [0.5, [224, 138, 90]], // sunset
  [0.58, [58, 74, 122]], // dusk blue
  [0.7, [11, 16, 38]], // night
  [0.8, [11, 16, 38]], // night
  [0.92, [42, 58, 102]], // pre-dawn
];

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpRGB(a: RGB, b: RGB, f: number): RGB {
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

export function skyColor(t: number): RGB {
  const n = normalizeTime(t);
  const keys = [...SKY_KEYS, [1.0, SKY_KEYS[0][1]] as [number, RGB]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, c0] = keys[i];
    const [t1, c1] = keys[i + 1];
    if (n >= t0 && n <= t1) {
      const f = t1 === t0 ? 0 : (n - t0) / (t1 - t0);
      return lerpRGB(c0, c1, f);
    }
  }
  return SKY_KEYS[0][1];
}

export interface DayNightSample {
  sky: RGB;
  /** Warm white by day, cool blue at night. */
  sunColor: RGB;
  sunIntensity: number;
  hemiIntensity: number;
  elevation: number;
  daylight: number;
}

export function sampleDayNight(t: number): DayNightSample {
  const n = normalizeTime(t);
  const d = daylight(n);
  const e = sunElevation(n);
  // Warm tint near the horizon (both dawn and dusk).
  const warmth = Math.min(1, Math.max(0, 1 - Math.abs(e) * 2.5));
  const warm: RGB = [255, 170, 110];
  const noon: RGB = [255, 255, 255];
  const night: RGB = [150, 180, 255];
  const dayMix: RGB = lerpRGB(noon, warm, warmth);
  const finalSun: RGB = lerpRGB(night, dayMix, d);
  return {
    sky: skyColor(n),
    sunColor: finalSun,
    sunIntensity: 0.15 + 0.95 * d,
    hemiIntensity: 0.25 + 0.65 * d,
    elevation: e,
    daylight: d,
  };
}

/** "HH:MM" clock label for the HUD (t=0 is 06:00 sunrise, MC convention). */
export function formatTime(t: number): string {
  const mins = Math.floor(normalizeTime(t) * 24 * 60 + 6 * 60) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Sun glyph for the HUD clock. */
export function timeGlyph(t: number): string {
  return daylight(t) > 0.15 ? '☀' : '☾';
}
