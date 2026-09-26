import * as THREE from 'three';
import { VoxelStore } from './store';
import { meshChunk, CHUNK_SIZE } from './mesher';

/**
 * Owns one THREE.Mesh per 16x16 column-chunk.
 * Mesher emits world-space positions, so chunk meshes stay at origin
 * with an identity transform (matrixAutoUpdate=false, frustumCulled=true).
 */
export class ChunkManager {
  private meshes = new Map<string, THREE.Mesh>();
  private dirty = new Set<string>();
  private scene: THREE.Scene | null = null;
  private store: VoxelStore | null = null;
  private material: THREE.Material | null = null;

  /** Mesh all chunks and add them to the scene. Wires store.onDirty -> dirty set. */
  buildAll(scene: THREE.Scene, store: VoxelStore, material: THREE.Material): void {
    this.dispose();
    this.scene = scene;
    this.store = store;
    this.material = material;

    // Chain any pre-existing onDirty handler instead of clobbering it.
    const prev = store.onDirty;
    store.onDirty = (key: string) => {
      prev?.(key);
      this.dirty.add(key);
    };

    const chunksX = Math.ceil(store.sx / CHUNK_SIZE);
    const chunksZ = Math.ceil(store.sz / CHUNK_SIZE);
    for (let cx = 0; cx < chunksX; cx++) {
      for (let cz = 0; cz < chunksZ; cz++) {
        const mesh = this.buildMesh(cx, cz);
        this.meshes.set(`${cx},${cz}`, mesh);
        scene.add(mesh);
      }
    }
  }

  private buildMesh(cx: number, cz: number): THREE.Mesh {
    const geo = meshChunk(this.store as VoxelStore, cx, cz);
    const mesh = new THREE.Mesh(geo, this.material as THREE.Material);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    mesh.updateMatrix();
    return mesh;
  }

  /**
   * Re-mesh dirty chunks, disposing old geometry.
   * If `keys` is omitted, drains the dirty set collected via store.onDirty.
   */
  rebuildDirty(store?: VoxelStore, keys?: Iterable<string>): string[] {
    const active = store ?? this.store;
    if (!active || !this.scene || !this.material) return [];
    const queue: string[] = keys ? [...keys] : [...this.dirty];
    this.dirty.clear();
    const rebuilt: string[] = [];
    for (const key of queue) {
      const parts = key.split(',');
      if (parts.length !== 2) continue;
      const cx = Number(parts[0]);
      const cz = Number(parts[1]);
      if (!Number.isInteger(cx) || !Number.isInteger(cz)) continue;
      if (cx < 0 || cz < 0) continue;
      if (cx >= Math.ceil(active.sx / CHUNK_SIZE)) continue;
      if (cz >= Math.ceil(active.sz / CHUNK_SIZE)) continue;
      const geo = meshChunk(active, cx, cz);
      const existing = this.meshes.get(key);
      if (existing) {
        existing.geometry.dispose();
        existing.geometry = geo;
      } else {
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = true;
        mesh.updateMatrix();
        this.meshes.set(key, mesh);
        this.scene.add(mesh);
      }
      rebuilt.push(key);
    }
    return rebuilt;
  }

  /** Number of live chunk meshes (8x8=64 for the full 128x128 map). */
  get count(): number {
    return this.meshes.size;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.scene?.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.dirty.clear();
  }
}
