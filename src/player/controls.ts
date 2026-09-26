/** PlayerController: pointer-lock FPS controls driving the physics AABB. */

import * as THREE from 'three';
import type { VoxelStore } from '../voxel/store';
import {
  EYE_HEIGHT,
  FLY_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  SPRINT_SPEED,
  WALK_SPEED,
  collide,
} from './physics';

export class PlayerController {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  fly = false;
  sensitivity = 0.0025;
  private keys = new Set<string>();

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private store: VoxelStore,
    spawn?: THREE.Vector3,
  ) {
    if (spawn) this.pos.copy(spawn);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    this.applyCamera();
  }

  setSensitivity(s: number): void {
    this.sensitivity = s;
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= e.movementX * this.sensitivity;
    this.pitch -= e.movementY * this.sensitivity;
    const limit = Math.PI / 2 - 0.01;
    if (this.pitch > limit) this.pitch = limit;
    if (this.pitch < -limit) this.pitch = -limit;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyF') {
      this.fly = !this.fly;
      this.vel.y = 0;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  update(dt: number): void {
    if (dt > 0) {
      const k = this.keys;
      const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
      const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      const sprint = k.has('ControlLeft') || k.has('ControlRight');
      const speed = this.fly ? FLY_SPEED : sprint ? SPRINT_SPEED : WALK_SPEED;

      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      let mx = -sin * fwd + cos * strafe;
      let mz = -cos * fwd - sin * strafe;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      this.vel.x = mx * speed;
      this.vel.z = mz * speed;

      if (this.fly) {
        const up =
          (k.has('Space') ? 1 : 0) -
          (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0);
        this.vel.y = up * speed;
      } else {
        this.vel.y -= GRAVITY * dt;
        if (k.has('Space') && this.onGround) this.vel.y = JUMP_VELOCITY;
      }

      const r = collide(this.store, this.pos, this.vel, dt);
      this.pos.set(r.pos.x, r.pos.y, r.pos.z);
      this.vel.set(r.vel.x, r.vel.y, r.vel.z);
      this.onGround = r.onGround;
    }
    this.applyCamera();
  }

  private applyCamera(): void {
    this.camera.position.set(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
