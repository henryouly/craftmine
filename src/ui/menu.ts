import { setSensitivity, type World } from '../game';

export const SAVE_KEY = 'craftmine-v1';

let initialized = false;

function lockPointer(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  try {
    const r = canvas?.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {
      // Denied (permissions/headless); overlays still work.
    });
  } catch {
    // Headless / unsupported: overlays still work.
  }
}

/**
 * Start overlay (title + Play) and pause overlay (Resume / seed+Regen /
 * Export / Import / Clear Save / sensitivity). Task 10 wires persistence:
 * Export dispatches `craftmine:export`, Import dispatches `craftmine:import`
 * with `{ text }`.
 */
export function initMenu(world: World): void {
  if (initialized) return;
  initialized = true;

  let start = document.getElementById('startOverlay');
  if (!start) {
    start = document.createElement('div');
    start.id = 'startOverlay';
    start.className = 'overlay';
    start.innerHTML = `<div class="card"><h1>Craftmine</h1><button id="playBtn">Play</button></div>`;
    document.body.appendChild(start);
  }

  let pause = document.getElementById('pauseOverlay');
  if (!pause) {
    pause = document.createElement('div');
    pause.id = 'pauseOverlay';
    pause.className = 'overlay hidden';
    pause.innerHTML = `<div class="card">
<h1>Paused</h1>
<button id="resumeBtn">Resume</button>
<label>Seed <input id="seedInput" type="number" value="${world.seed}" /></label>
<button id="regenBtn">Regenerate</button>
<button id="exportBtn">Export JSON</button>
<label class="file">Import JSON <input id="importInput" type="file" accept="application/json" /></label>
<button id="clearBtn">Clear Save</button>
<label>Sensitivity <input id="sensInput" type="range" min="0.0005" max="0.01" step="0.0005" value="0.0025" /></label>
</div>`;
    document.body.appendChild(pause);
  }
  const startEl = start;
  const pauseEl = pause;

  const playBtn = document.getElementById('playBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const seedInput = document.getElementById('seedInput') as HTMLInputElement | null;
  const regenBtn = document.getElementById('regenBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput') as HTMLInputElement | null;
  const clearBtn = document.getElementById('clearBtn');
  const sensInput = document.getElementById('sensInput') as HTMLInputElement | null;

  playBtn?.addEventListener('click', () => {
    startEl.classList.add('hidden');
    lockPointer();
  });
  resumeBtn?.addEventListener('click', () => lockPointer());
  regenBtn?.addEventListener('click', () => {
    const seed = Number(seedInput?.value ?? world.seed);
    if (Number.isFinite(seed)) world.regen(Math.floor(seed));
  });
  exportBtn?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('craftmine:export'));
  });
  importInput?.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      window.dispatchEvent(new CustomEvent('craftmine:import', { detail: { text } }));
    });
    importInput.value = '';
  });
  clearBtn?.addEventListener('click', () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Storage unavailable; nothing to clear.
    }
  });
  sensInput?.addEventListener('input', () => {
    const v = Number(sensInput.value);
    if (Number.isFinite(v)) setSensitivity(v);
  });

  // Esc unlock shows pause; re-lock hides menus.
  let started = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement != null;
    if (locked) {
      started = true;
      startEl.classList.add('hidden');
      pauseEl.classList.add('hidden');
    } else if (started) {
      pauseEl.classList.remove('hidden');
    }
  });
}
