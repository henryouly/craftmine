import * as THREE from 'three';
import { VoxelStore } from './store';
import { tileUV, getTileForBlock, type BlockFace } from './atlas';

export const CHUNK_SIZE = 16;

/** Block ids that don't fully occlude neighbors (see-through). */
function isTransparent(id: number): boolean {
  return id === 8 /* glass */ || id === 5 /* leaves */;
}

interface FaceDef {
  dir: [number, number, number];
  corners: [number, number, number][];
  shade: number;
  face: BlockFace;
}

const FACES: FaceDef[] = [
  {
    // +X
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.8,
    face: 'side',
  },
  {
    // -X
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.8,
    face: 'side',
  },
  {
    // +Y (top)
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1.0,
    face: 'top',
  },
  {
    // -Y (bottom)
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.5,
    face: 'bottom',
  },
  {
    // +Z
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.6,
    face: 'side',
  },
  {
    // -Z
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.6,
    face: 'side',
  },
];

/**
 * Mesh chunk (cx,cz) into an indexed BufferGeometry.
 * Emits a face when the neighbor is air, or when the neighbor is
 * transparent (glass/leaves) and of a different type.
 */
export function meshChunk(store: VoxelStore, cx: number, cz: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;

  for (let x = x0; x < x0 + CHUNK_SIZE; x++) {
    for (let z = z0; z < z0 + CHUNK_SIZE; z++) {
      for (let y = 0; y < store.sy; y++) {
        const id = store.get(x, y, z);
        if (id === 0) continue;

        for (const f of FACES) {
          const nid = store.get(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
          if (nid !== 0 && !(isTransparent(nid) && nid !== id)) continue;

          const tile = getTileForBlock(id, f.face);
          const [u0, v0, u1, v1] = tileUV(tile);
          // corners are ordered BL, BR, TR, TL (CCW from outside)
          const faceUV: [number, number][] = [
            [u0, v0],
            [u1, v0],
            [u1, v1],
            [u0, v1],
          ];

          const base = positions.length / 3;
          for (let i = 0; i < 4; i++) {
            positions.push(x + f.corners[i][0], y + f.corners[i][1], z + f.corners[i][2]);
            normals.push(f.dir[0], f.dir[1], f.dir[2]);
            uvs.push(faceUV[i][0], faceUV[i][1]);
            colors.push(f.shade, f.shade, f.shade);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}
