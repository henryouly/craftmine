/** VoxelStore: Uint8Array source of truth for the voxel world. No Three.js. */

export const SIZE = 128;
export const HEIGHT = 48;
export const CHUNK = 16;

/** Block ids: 0=air,1=grass,2=dirt,3=stone,4=log,5=leaves,6=sand,7=planks,8=glass,9=brick,10=bedrock. */
export class VoxelStore {
  data: Uint8Array;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  onDirty?: (key: string) => void;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    this.data = new Uint8Array(sx * sy * sz);
  }

  idx(x: number, y: number, z: number): number {
    return x + z * this.sx + y * this.sx * this.sz;
  }

  private inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[this.idx(x, y, z)];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    const maxCx = Math.ceil(this.sx / CHUNK) - 1;
    const maxCz = Math.ceil(this.sz / CHUNK) - 1;
    const keys: string[] = [`${cx},${cz}`];
    if (lx === 0 && cx - 1 >= 0) keys.push(`${cx - 1},${cz}`);
    if (lx === CHUNK - 1 && cx + 1 <= maxCx) keys.push(`${cx + 1},${cz}`);
    if (lz === 0 && cz - 1 >= 0) keys.push(`${cx},${cz - 1}`);
    if (lz === CHUNK - 1 && cz + 1 <= maxCz) keys.push(`${cx},${cz + 1}`);
    for (const k of keys) this.onDirty?.(k);
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) !== 0;
  }
}
