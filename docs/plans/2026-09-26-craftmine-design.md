# Craftmine - Creative Sandbox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Browser-playable Minecraft-like creative sandbox on fixed 128x128 map with FPS controls and local save.

**Architecture:** Vite SPA, 3 layers: VoxelStore (Uint8Array source of truth) -> Chunk Mesher (face-culled BufferGeometry per 16x16 chunk) -> PlayerController + Three.js renderer. No backend.

**Tech Stack:** Vite 5 + TypeScript 5 strict + Three.js 0.160+ + Vitest. Plain HTML/CSS HUD, no UI framework.

---

## Validated Design Summary (5/5 sections approved 2026-09-26)

### 1. Vision & Scope
Creative sandbox MVP. Walk/fly fixed voxel world, break/place, autosave locally. <5s load, 60fps.
- IN: 128x128 x H48, 8-10 blocks, FPS pointer-lock, WASD+Space+F fly, 1-9/wheel hotbar, LMB/RMB edit, chunked meshing, localStorage diff save, Export/Import JSON, crosshair/hotbar/FPS HUD.
- OUT: infinite terrain, caves/biomes/redstone, survival/mobs, multiplayer, mobile, sound, backend.
- Success: `npm run dev` -> 60fps, edit remesh <50ms, reload preserves edits.

### 2. Architecture
- `VoxelStore`: Uint8Array [128*H*128], get/set, isSolid, onChunkDirty event.
- `Mesher`: per-chunk BufferGeometry, face culling, atlas UV, face shading (top 1.0, x/z 0.8/0.6, bottom 0.5).
- `PlayerController`: pointer-lock, AABB 0.6x1.8 eye 1.62, per-axis collision, raycast max 8.
- Folders: src/voxel/, src/player/, src/ui/, src/save/, tests/.

### 3. World, Blocks & Generation
- Coords Y-up, id=x+z*128+y*128*128. 0=air,1=grass,2=dirt,3=stone,4=log,5=leaves,6=sand,7=planks,8=glass,9=brick,10=bedrock.
- Gen (seeded): h=18+noise octaves*8, grass/dirt(3)/stone/bedrock y=0, sand if h<20, trees 1% on grass (4-5 log + 3x3x2 leaves), spawn center flattened 5x5.
- Mesher: 8x8 chunks of 16x16, glass/leaves no cull between same type, alphaTest 0.5. Atlas 64x64, 16 tiles 16px, NearestFilter SRGB. Real pack (`assets/minecraft/textures/block/*.png`) composited at runtime via `loadAtlasTexture()` in `src/voxel/atlas.ts`; procedural `makeAtlasTexture()` is fallback. Log uses tile 11 (`log_top`) for top/bottom.

### 4. Controls, Interaction & UI
- Click->pointer lock, Esc menu, WASD, Space jump 8.5/gravity 25, F fly, speed 5 walk/8 sprint/12 fly.
- LMB break (200ms repeat), RMB place if empty + not intersecting player, R highlight wireframe. Bedrock unbreakable.
- Camera 75deg, sun directional + hemi, Fog(60,180), static noon.
- HUD: crosshair, hotbar 9 slots, FPS/XYZ, help H, start overlay (title+Play), pause overlay (Resume/Regen+seed/Export/Import/Clear/sensitivity).

### 5. Save, Perf, Testing
- localStorage `craftmine-v1:{seed,diff:{index:id}}`, debounce 1s + unload, corrupt->regen+toast.
- Budget: gen+mesh <1.5s, edit <50ms, 1 draw/chunk (~64), pixelRatio<=2, frustum cull.
- Tests: Vitest store/mesher/worldgen deterministic + playtest checklist.

---

## Task 1: Scaffold Vite + TS + Three + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`
- Test: `tests/smoke.test.ts`

**Step 1: Write failing test**
```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('boots', () => { expect(true).toBe(true); }); });
```

**Step 2: Run to verify**
Run: `npm install && npx vitest run tests/smoke.test.ts`
Expected: PASS (scaffold check)

**Step 3: Minimal scaffold**
```json
// package.json deps: three@^0.160.0, dev: vite@^5, typescript@^5, vitest, @types/three
// vite.config.ts: defineConfig({ server: { port: 5173 } })
// index.html: <canvas id="game"> + <div id="hud"> + script /src/main.ts
// src/main.ts: import * as THREE from 'three'; console.log('craftmine boot');
```

**Step 4: Verify**
Run: `npx tsc --noEmit && npx vitest run && npm run dev`
Expected: no type errors, tests pass, http://localhost:5173 shows canvas.

**Step 5: Commit**
```bash
git init 2>/dev/null || true; git add -A; git commit -m "feat: scaffold vite+three+vitest"
```

## Task 2: Texture Atlas

**Files:**
- Create: `src/voxel/atlas.ts`, `public/atlas.png` (or procedural fallback)
- Test: `tests/atlas.test.ts`

**Step 1: Failing test**
```ts
// uv for tile 0 should be within [0,1]
import { tileUV } from '../src/voxel/atlas';
import { describe,it,expect } from 'vitest';
describe('atlas',()=>{ it('tileUV in range',()=>{ const [u0,v0,u1,v1]=tileUV(0,16); expect(u0).toBeGreaterThanOrEqual(0); expect(u1).toBeLessThanOrEqual(1); }); });
```

**Step 2: Run**
Run: `npx vitest run tests/atlas.test.ts`
Expected: FAIL "function not defined"

**Step 3: Implement**
```ts
// src/voxel/atlas.ts - 16 tiles in 4x4 grid, 16px each on 64x64 canvas (MVP procedural)
// export const TILES = {grass_top:0, grass_side:1, dirt:2, stone:3, log:4, leaves:5, sand:6, planks:7, glass:8, brick:9, bedrock:10}
// export function tileUV(i:number, count=16):[number,number,number,number] { ... }
// export function makeAtlasTexture(): THREE.CanvasTexture { draw pixel-art colors per tile + noise; NearestFilter; SRGB }
```

**Step 4: Verify** `npx vitest run tests/atlas.test.ts` -> PASS

**Step 5: Commit** `git add src/voxel/atlas.ts tests/atlas.test.ts; git commit -m "feat: texture atlas + uv mapping"`

## Task 3: VoxelStore (data layer, no Three.js)

**Files:**
- Create: `src/voxel/store.ts`
- Test: `tests/store.test.ts`

**Step 1: Failing tests**
```ts
import { VoxelStore } from '../src/voxel/store';
import { describe,it,expect } from 'vitest';
describe('store',()=>{
 it('set/get roundtrip',()=>{ const s=new VoxelStore(32,16,32); s.set(1,2,3,5); expect(s.get(1,2,3)).toBe(5); });
 it('oob returns 0',()=>{ const s=new VoxelStore(32,16,32); expect(s.get(-1,0,0)).toBe(0); });
 it('marks chunk dirty',()=>{ const s=new VoxelStore(128,48,128); let f:string[]=[]; s.onDirty=(c)=>f.push(c); s.set(17,10,5,1); expect(f).toContain('1,0'); });
});
```

**Step 2: Run** -> FAIL

**Step 3: Implement**
```ts
// export const SIZE=128, HEIGHT=48, CHUNK=16
// export class VoxelStore { data:Uint8Array; constructor(sx,sy,sz); idx(x,y,z); get(x,y,z): number (0 if oob); set(x,y,z,id): marks `${cx},${cz}` dirty + neighbor if on border; isSolid(x,y,z); onDirty?: (key:string)=>void }
```

**Step 4: Verify** `npx vitest run tests/store.test.ts` -> PASS

**Step 5: Commit**

## Task 4: Chunk Mesher (face culling)

**Files:**
- Create: `src/voxel/mesher.ts`
- Test: `tests/mesher.test.ts`

**Step 1: Failing test**
```ts
import { meshChunk } from '../src/voxel/mesher';
import { VoxelStore } from '../src/voxel/store';
// single solid cube -> 6 quads = 12 tris = 24 verts
describe('mesher',()=>{ it('single cube 6 faces',()=>{ const s=new VoxelStore(16,16,16); s.set(8,8,8,3); const g=meshChunk(s,0,0); expect(g.index.count).toBe(36); }); it('hidden faces culled',()=>{ const s=new VoxelStore(16,16,16); s.set(8,8,8,3); s.set(9,8,8,3); const g=meshChunk(s,0,0); expect(g.index.count).toBeLessThan(72); }); });
```

**Step 2: Run** -> FAIL

**Step 3: Implement**
```ts
// meshChunk(store, cx, cz): iterate x in [cx*16,cx*16+15], y 0..H, z...; for 6 dirs if neighbor air or (transparent && neighbor!==same) emit quad with positions/normals/uv(via tileUV per block+face)/shade; return BufferGeometry with index
// face shading: y+ 1.0, y- 0.5, x 0.8, z 0.6 ; transparent = glass(8), leaves(5)
```

**Step 4: Verify** PASS + manual: render one chunk gray.

**Step 5: Commit**

## Task 5: Worldgen (seeded)

**Files:**
- Create: `src/voxel/worldgen.ts`
- Test: `tests/worldgen.test.ts`

**Step 1: Failing test**
```ts
import { generate } from '../src/voxel/worldgen';
describe('worldgen',()=>{ it('deterministic',()=>{ const a=generate(42); const b=generate(42); expect(a.get(64,20,64)).toBe(b.get(64,20,64)); }); it('has grass + bedrock',()=>{ const s=generate(1); let grass=false,bed=false; for(let x=60;x<70;x++)for(let z=60;z<70;z++)for(let y=0;y<48;y++){ const v=s.get(x,y,z); if(v===1)grass=true; if(v===10)bed=true; } expect(grass&&bed).toBe(true); }); });
```

**Step 2: Run** -> FAIL

**Step 3: Implement**
```ts
// mulberry32(seed) + valueNoise2D with hash; h(x,z)=18+oct*8 (3 octaves, freq 1/32,1/16,1/8)
// layers: y=0 bedrock, y<h-3 stone, h-3..h-1 dirt (sand if h<20), top h grass; trees: hash(x,z)<0.01 && grass && h>21 -> trunk 4 + leaves 3x3x2
// flatten spawn 5x5 around center to h_center
```

**Step 4: Verify** PASS, gen time `console.time` <300ms.

**Step 5: Commit**

## Task 6: Renderer + Game Loop + Chunk Manager

**Files:**
- Create: `src/game.ts`, `src/voxel/chunks.ts`
- Modify: `src/main.ts`

**Steps:**
1. `chunks.ts`: Map<key,Mesh>, `buildAll(scene,store,material)`, `rebuildDirty(store)` disposes old geometry.
2. `game.ts`: Scene, fog(60,180), hemi+dir light, PerspectiveCamera 75, WebGLRenderer antialias, resize handler, `requestAnimationFrame` loop with dt clamp 0.05, FPS counter.
3. Verify manually: `npm run dev` shows terrain, 8x8=64 draw calls, no errors.
4. Commit.

## Task 7: Player Physics + Pointer-Lock Controls

**Files:**
- Create: `src/player/controls.ts`, `src/player/physics.ts`
- Test: `tests/physics.test.ts` (AABB collide pure function)

**Steps:**
1. Test: `collide(pos,vel,store)` stops at wall, lands on ground.
2. Implement per-axis resolve: move x->check solid AABB->clamp, then y, then z. onGround flag. Gravity 25, jump 8.5, speeds 5/8/12, fly toggle F (no gravity, Space up / Shift down).
3. Controls: pointerlock mousemove yaw/pitch (sensitivity 0.0025 slider), WASD key state.
4. Verify: walk/jump/fly, no clip through ground, spawn (64,h+2,64).
5. Commit.

## Task 8: Raycast Break/Place + Highlight

**Files:**
- Create: `src/player/raycast.ts`
- Modify: `src/game.ts`, `src/voxel/chunks.ts`

**Steps:**
1. DDA voxel traversal max 8 from camera, return {x,y,z,nx,ny,nz}.
2. LMB break (skip bedrock y=0), RMB place selected hotbar id if target empty + player AABB not intersect. Hold repeat 200ms.
3. Wireframe LineSegments highlight + `rebuildDirty`.
4. Verify: break/place <50ms (performance.now log), edge of chunk updates neighbor.
5. Commit.

## Task 9: HUD / Hotbar / Menus (HTML/CSS)

**Files:**
- Create: `src/ui/hud.ts`, `src/ui/hotbar.ts`, `src/ui/menu.ts`
- Modify: `index.html`, `src/style.css`

**Steps:**
1. Crosshair div, hotbar 9 slots (canvas icons from atlas tiles), keys 1-9+wheel, selected highlight.
2. Top-right debug FPS/XYZ, H toggles help.
3. Start overlay Play button (requests pointer lock), pause overlay Esc: Resume, seed input+Regenerate, Export/Import JSON, Clear Save, sensitivity.
4. Verify: click Play locks, Esc unlocks shows menu, hotbar switches.
5. Commit.

## Task 10: Save (localStorage diff) + Export/Import

**Files:**
- Create: `src/save/storage.ts`
- Test: `tests/storage.test.ts` (roundtrip diff apply)

**Steps:**
1. Test: `collectDiff(base, edited)` + `applyDiff(store,diff)` preserves edits.
2. Implement: key `craftmine-v1:{seed,diff}`, track Set<dirtyIndex> on set(), debounce save 1s + beforeunload. Load: generate(seed)->apply. Corrupt JSON->backup to `craftmine-bak` + regen.
3. Export button downloads world.json, Import file input parses.
4. Verify: place 5 blocks, reload, still there. Clear Save wipes.
5. Commit.

## Task 11: Polish, Perf, Final Verify

**Files:** all.

- Cap pixelRatio min(devicePixelRatio,2), `powerPreference:'high-performance'`, frustumCulled=true per chunk.
- Static noon lighting, NearestFilter everywhere.
- Run: `npx tsc --noEmit && npx vitest run && npm run build` -> all green.
- Playtest 60s: lock/unlock, jump/fly, break/place at chunk border, reload, FPS log screenshot.
- Commit `chore: mvp polish + perf`.

---
*Next: open new session with executing-plans to build Task 1->11.*
