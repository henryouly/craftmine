import * as THREE from 'three';
import { loadAtlasTexture } from './voxel/atlas';
import { generate } from './voxel/worldgen';
import { HEIGHT, VoxelStore } from './voxel/store';
import { ChunkManager } from './voxel/chunks';
import { PlayerController } from './player/controls';
import { HALF_WIDTH, PLAYER_HEIGHT } from './player/physics';
import { raycastVoxel } from './player/raycast';
import { initHotbar } from './ui/hotbar';
import { initHud } from './ui/hud';
import { initMenu } from './ui/menu';
import {
  applyDiff,
  collectDiff,
  loadGame,
  parseSave,
  saveGame,
} from './save/storage';
import {
  advanceTime,
  formatTime,
  normalizeTime,
  sampleDayNight,
  timeGlyph,
} from './world/daynight';

export const REACH = 8;
export const REPEAT_MS = 200;
export const BEDROCK_ID = 10;

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  store: VoxelStore;
  chunks: ChunkManager;
  material: THREE.Material;
  seed: number;
  player: PlayerController;
  /** Block id placed by RMB. Hotbar wiring (Task 9) mutates this. */
  selectedBlock: number;
  /** Regenerate terrain from a seed, rebuild chunks, respawn the player. */
  regen: (seed: number) => void;
  /** Day/night clock controls (wired to the pause menu). */
  getTime: () => number;
  setTime: (t: number) => void;
  setCyclePaused: (paused: boolean) => void;
}

let world: World | null = null;

/** Current world, available after startGame() resolves (used by later tasks). */
export function getWorld(): World | null {
  return world;
}

/** Adjust look sensitivity on the active player (used by the pause menu slider). */
export function setSensitivity(s: number): void {
  world?.player.setSensitivity(s);
}

/** Hotbar wiring (Task 9): set the active block id for RMB placement. */
export function setSelectedBlock(id: number): void {
  if (world) world.selectedBlock = id;
}

if (typeof window !== 'undefined') {
  window.addEventListener('craftmine:select-block', ((e: Event) => {
    const detail = (e as CustomEvent<number>).detail;
    if (typeof detail === 'number') setSelectedBlock(detail);
  }) as EventListener);
}

/** True when AABB [min,max) overlaps the target unit voxel. */
export function voxelIntersectsAABB(
  tx: number,
  ty: number,
  tz: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  return (
    tx < maxX && tx + 1 > minX && ty < maxY && ty + 1 > minY && tz < maxZ && tz + 1 > minZ
  );
}

/** True when placing a block at (tx,ty,tz) would collide with the player. */
export function placeIntersectsPlayer(
  tx: number,
  ty: number,
  tz: number,
  px: number,
  py: number,
  pz: number,
  halfW = HALF_WIDTH,
  height = PLAYER_HEIGHT,
): boolean {
  return voxelIntersectsAABB(
    tx,
    ty,
    tz,
    px - halfW,
    py,
    pz - halfW,
    px + halfW,
    py + height,
    pz + halfW,
  );
}
/** Top solid block at (x,z), or 0 if the column is empty. */
function groundHeight(store: VoxelStore, x: number, z: number): number {
  for (let y = HEIGHT - 1; y > 0; y--) {
    if (store.isSolid(x, y, z)) return y;
  }
  return 0;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<World> {
  const scene = new THREE.Scene();
  const bg = new THREE.Color(0x87ceeb);
  scene.background = bg;
  const fog = new THREE.Fog(0x87ceeb, 60, 180);
  scene.fog = fog;

  // Day/night lighting: orbit + colors driven per-frame by the clock.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.target.position.set(64, 0, 64);
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const atlas = await loadAtlasTexture();
  const material = new THREE.MeshLambertMaterial({
    map: atlas,
    vertexColors: true,
    alphaTest: 0.5,
    side: THREE.FrontSide,
  });

  const saved = loadGame();
  const seed = saved?.seed ?? 1337;
  // Day/night clock: resume saved time, otherwise start in the morning.
  let timeOfDay = normalizeTime(saved?.time ?? 0.1);
  let cyclePaused = false;
  const store = generate(seed);
  // Pristine snapshot for diff-based saves. Edits only touch `store`,
  // so diffing against this stays correct between regens.
  let base = generate(seed);
  if (saved) applyDiff(store, saved.diff);
  const chunks = new ChunkManager();

  let dirtySinceSave = false;
  let lastSaveAt = 0;
  const onEdit = (): void => {
    dirtySinceSave = true;
  };
  // Reset the onDirty chain before each buildAll so regen/import never
  // accumulate stale wrappers: save listener first, chunk forwarder chained.
  function rewireChunks(): void {
    store.onDirty = onEdit;
    chunks.buildAll(scene, store, material);
  }
  rewireChunks();

  // FPS player spawned above the flattened center.
  const h = groundHeight(store, 64, 64);
  const player = new PlayerController(
    canvas,
    camera,
    store,
    new THREE.Vector3(64.5, h + 2.5, 64.5),
  );

  canvas.addEventListener('click', () => {
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {
        // Pointer lock denied (e.g. permissions/headless); game still renders.
      });
    } catch {
      // Pointer lock unavailable (e.g. headless); game still renders.
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Target-block wireframe highlight.
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
  );
  highlight.visible = false;
  scene.add(highlight);

  const w: World = {
    scene,
    camera,
    renderer,
    store,
    chunks,
    material,
    seed,
    player,
    selectedBlock: 1,
    getTime: () => timeOfDay,
    setTime: (t: number) => {
      timeOfDay = normalizeTime(t);
    },
    setCyclePaused: (paused: boolean) => {
      cyclePaused = paused;
    },
    regen: (nextSeed: number) => {
      const fresh = generate(nextSeed);
      store.data.set(fresh.data);
      base = fresh;
      w.seed = nextSeed;
      rewireChunks();
      const gh = groundHeight(store, 64, 64);
      player.pos.set(64.5, gh + 2.5, 64.5);
      player.vel.set(0, 0, 0);
      saveGame(w.seed, store, base, timeOfDay);
      dirtySinceSave = false;
      lastSaveAt = performance.now();
    },
  };

  window.addEventListener('craftmine:export', () => {
    saveGame(w.seed, store, base, timeOfDay);
    dirtySinceSave = false;
    lastSaveAt = performance.now();
    const payload = JSON.stringify({
      seed: w.seed,
      diff: collectDiff(base, store),
      time: timeOfDay,
    });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  window.addEventListener('craftmine:import', ((e: Event) => {
    const text = (e as CustomEvent<{ text: string }>).detail?.text;
    if (typeof text !== 'string') return;
    const parsed = parseSave(text);
    if (!parsed) return;
    timeOfDay = normalizeTime(parsed.time ?? timeOfDay);
    const fresh = generate(parsed.seed);
    store.data.set(fresh.data);
    applyDiff(store, parsed.diff);
    base = fresh;
    w.seed = parsed.seed;
    rewireChunks();
    const gh = groundHeight(store, 64, 64);
    player.pos.set(64.5, gh + 2.5, 64.5);
    player.vel.set(0, 0, 0);
    saveGame(w.seed, store, base, timeOfDay);
    dirtySinceSave = false;
    lastSaveAt = performance.now();
  }) as EventListener);
  window.addEventListener('craftmine:set-time', ((e: Event) => {
    const t = (e as CustomEvent<number>).detail;
    if (typeof t === 'number') {
      timeOfDay = normalizeTime(t);
      saveGame(w.seed, store, base, timeOfDay);
    }
  }) as EventListener);
  window.addEventListener('craftmine:toggle-cycle', ((e: Event) => {
    const paused = (e as CustomEvent<boolean>).detail;
    if (typeof paused === 'boolean') cyclePaused = paused;
  }) as EventListener);
  window.addEventListener('beforeunload', () => {
    if (dirtySinceSave) saveGame(w.seed, store, base, timeOfDay);
  });

  initHotbar();
  initHud();
  initMenu(w);

  const isLocked = (): boolean => document.pointerLockElement === canvas;

  const aimDir = new THREE.Vector3();
  function aimHit(): ReturnType<typeof raycastVoxel> {
    camera.getWorldDirection(aimDir);
    return raycastVoxel(
      store,
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      { x: aimDir.x, y: aimDir.y, z: aimDir.z },
      REACH,
    );
  }

  /** LMB: remove the targeted block unless bedrock or the y==0 floor. */
  function doBreak(): void {
    const hit = aimHit();
    if (!hit) return;
    if (hit.y === 0) return;
    const id = store.get(hit.x, hit.y, hit.z);
    if (id === 0 || id === BEDROCK_ID) return;
    store.set(hit.x, hit.y, hit.z, 0);
  }

  /** RMB: place the selected block against the targeted face. */
  function doPlace(): void {
    const hit = aimHit();
    if (!hit) return;
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz;
    if (store.get(tx, ty, tz) !== 0) return;
    const p = player.pos;
    if (placeIntersectsPlayer(tx, ty, tz, p.x, p.y, p.z)) return;
    store.set(tx, ty, tz, w.selectedBlock);
  }

  const held = new Set<number>();
  let lastBreakAt = 0;
  let lastPlaceAt = 0;

  document.addEventListener('mousedown', (e) => {
    if (!isLocked()) return;
    if (e.button !== 0 && e.button !== 2) return;
    held.add(e.button);
    const now = performance.now();
    if (e.button === 0) {
      doBreak();
      lastBreakAt = now;
    } else {
      doPlace();
      lastPlaceAt = now;
    }
  });
  document.addEventListener('mouseup', (e) => {
    held.delete(e.button);
  });
  document.addEventListener('pointerlockchange', () => {
    if (!isLocked()) held.clear();
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const debugEl = document.getElementById('debug');
  let last = performance.now();
  let frames = 0;
  let lastFpsT = last;

  function frame(now: number): void {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    player.update(dt);

    // Hold-to-repeat edits (200ms) while the button is held + pointer locked.
    if (isLocked()) {
      if (held.has(0) && now - lastBreakAt >= REPEAT_MS) {
        doBreak();
        lastBreakAt = now;
      }
      if (held.has(2) && now - lastPlaceAt >= REPEAT_MS) {
        doPlace();
        lastPlaceAt = now;
      }
    }

    // Block highlight follows the camera ray.
    if (isLocked()) {
      const hit = aimHit();
      if (hit) {
        highlight.visible = true;
        highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else {
        highlight.visible = false;
      }
    } else {
      highlight.visible = false;
    }

    // Debounced autosave: at most once per second, only after edits.
    // (Clock time is saved on set-time events, so the 1s loop skips it.)
    if (dirtySinceSave && now - lastSaveAt > 1000) {
      saveGame(w.seed, store, base, timeOfDay);
      dirtySinceSave = false;
      lastSaveAt = now;
    }

    // Day/night: advance the clock and drive sun + sky.
    if (!cyclePaused) timeOfDay = advanceTime(timeOfDay, dt * 1000);
    {
      const s = sampleDayNight(timeOfDay);
      // π/2 phase: sunrise east-horizon, noon overhead, sunset west-horizon.
      const orbit = (timeOfDay - 0.25) * Math.PI * 2 + Math.PI / 2;
      sun.position.set(
        64 + Math.cos(orbit) * 90,
        // Clamp above the horizon: at night the dim light reads as moonlight.
        Math.max(8, Math.sin(orbit) * 90 + 10),
        64 + 20,
      );
      sun.intensity = s.sunIntensity;
      sun.color.setRGB(s.sunColor[0] / 255, s.sunColor[1] / 255, s.sunColor[2] / 255);
      hemi.intensity = s.hemiIntensity;
      bg.setRGB(s.sky[0] / 255, s.sky[1] / 255, s.sky[2] / 255);
      fog.color.copy(bg);
    }

    // Apply any pending chunk remeshes (no-ops until edits exist).
    chunks.rebuildDirty();
    renderer.render(scene, camera);

    frames++;
    if (now - lastFpsT >= 500) {
      const fps = (frames * 1000) / (now - lastFpsT);
      frames = 0;
      lastFpsT = now;
      if (debugEl) {
        const p = player.pos;
        debugEl.textContent =
          `${fps.toFixed(0)} fps | ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} | ${timeGlyph(timeOfDay)} ${formatTime(timeOfDay)}`;
      }
    }
  }
  requestAnimationFrame(frame);

  world = w;
  return world;
}
