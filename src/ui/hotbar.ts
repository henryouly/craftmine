import { ATLAS_COLS, TILE_SIZE, getTileForBlock, makeAtlasTexture } from '../voxel/atlas';
import { setSelectedBlock } from '../game';

/** Block ids in hotbar order: grass, dirt, stone, log, leaves, sand, planks, glass, brick. */
export const HOTBAR_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

let initialized = false;

function selectSlot(slots: HTMLElement[], index: number): void {
  const i = ((index % slots.length) + slots.length) % slots.length;
  for (let k = 0; k < slots.length; k++) {
    slots[k].classList.toggle('selected', k === i);
  }
  const id = HOTBAR_IDS[i];
  setSelectedBlock(id);
  window.dispatchEvent(new CustomEvent<number>('craftmine:select-block', { detail: id }));
}

/** Render the 9-slot hotbar into #hotbar (created if missing). Idempotent. */
export function initHotbar(): void {
  if (initialized) return;
  initialized = true;

  let bar = document.getElementById('hotbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'hotbar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';

  const atlas = makeAtlasTexture().image as HTMLCanvasElement;
  const slots: HTMLElement[] = [];

  HOTBAR_IDS.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === 0 ? ' selected' : '');
    slot.dataset.block = String(id);

    const icon = document.createElement('canvas');
    icon.width = 32;
    icon.height = 32;
    const ctx = icon.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const tile = getTileForBlock(id, 'top');
      const ox = (tile % ATLAS_COLS) * TILE_SIZE;
      const oy = Math.floor(tile / ATLAS_COLS) * TILE_SIZE;
      ctx.drawImage(atlas, ox, oy, TILE_SIZE, TILE_SIZE, 0, 0, 32, 32);
    }
    slot.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'key';
    label.textContent = String(i + 1);
    slot.appendChild(label);

    slot.addEventListener('click', () => selectSlot(slots, i));
    bar.appendChild(slot);
    slots.push(slot);
  });

  let current = 0;
  const select = (i: number): void => {
    current = ((i % slots.length) + slots.length) % slots.length;
    selectSlot(slots, current);
  };

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 9) select(n - 1);
    }
  });
  document.addEventListener(
    'wheel',
    (e) => {
      if (document.pointerLockElement == null) return;
      select(current + (e.deltaY > 0 ? 1 : -1));
    },
    { passive: true },
  );

  // Default selection (slot 0 = grass).
  selectSlot(slots, 0);
}
