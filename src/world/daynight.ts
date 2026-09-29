/** Day/night cycle: pure time-of-day sampler (no Three.js dependency). */

export const DAY_LENGTH_MS = 1_200_000; // 20-minute MC cycle

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

/**
 * Eased sun orbit angle (radians) for positioning the sun.
 * Wiki: the sky moves faster at noon/midnight, slower at rise/set.
 * Warp: φ = θ − A·sin(2θ) with A = 0.12, so dφ/dθ peaks where
 * |elev| = 1 and dips where elev = 0. θ = 0 is sunrise, π/2 noon.
 */
export function sunOrbitAngle(t: number): number {
  const theta = normalizeTime(t) * Math.PI * 2;
  return theta - 0.12 * Math.sin(2 * theta);
}

/** Daylight factor 0..1, with a soft band around the horizon. */
export function daylight(t: number): number {
  const e = sunElevation(t);
  return Math.min(1, Math.max(0, e * 1.5 + 0.25));
}

export type RGB = [number, number, number];

/**
 * Vanilla-style sky, matching Java Edition behavior:
 * - Day = biome color (plains #78A7FF), night = pure #000000.
 * - Brightness = clamp(elev * 2 + 0.5, 0, 1), i.e. the classic
 *   cos(angle) * 2 + 0.5 darkening toward black at night.
 * - Warm wash near the horizon approximates the sunrise/sunset glow,
 *   which in vanilla fades between the biome color and orange.
 */
const PLAINS_DAY: RGB = [120, 167, 255]; // #78A7FF
const SUNSET_WASH: RGB = [255, 150, 80];

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function lerpRGB(a: RGB, b: RGB, f: number): RGB {
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

function scaleRGB(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

export function skyColor(t: number): RGB {
  const n = normalizeTime(t);
  const e = sunElevation(n);
  const bright = Math.min(1, Math.max(0, e * 2 + 0.5));
  const wash = Math.min(1, Math.max(0, 1 - Math.abs(e) / 0.4));
  const base = scaleRGB(PLAINS_DAY, bright);
  return lerpRGB(base, SUNSET_WASH, wash * 0.55);
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
