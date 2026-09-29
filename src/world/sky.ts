/** Visible sun + full moon sprites and night stars. No lighting changes. */

import * as THREE from 'three';
import { moonElevation, starAlpha, sunElevation, sunOrbitAngle } from './daynight';

const CENTER_X = 64;
const CENTER_Z = 64;
const RADIUS = 400;
const STAR_COUNT = 1000;

export interface SkyVisuals {
  update: (t: number) => void;
}

export function createSky(scene: THREE.Scene): SkyVisuals {
  // Sprites with no map render as solid squares: vanilla's square sun/moon.
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({ color: 0xffffc8, fog: false, depthWrite: false }),
  );
  sun.scale.set(30, 30, 1);
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ color: 0xdde3f0, fog: false, depthWrite: false }),
  );
  moon.scale.set(22, 22, 1);
  scene.add(sun);
  scene.add(moon);

  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Full sphere (vanilla-like): rotation keeps coverage complete, and the
    // terrain occludes the below-horizon half. Upper-dome-only left half
    // the sky empty once the field tilted.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const y = 2 * v - 1;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    positions[i * 3] = Math.cos(theta) * r * RADIUS;
    positions[i * 3 + 1] = y * RADIUS;
    positions[i * 3 + 2] = Math.sin(theta) * r * RADIUS;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.position.set(CENTER_X, 0, CENTER_Z);
  scene.add(stars);

  const dir = new THREE.Vector3();

  return {
    update(t: number): void {
      const orbit = sunOrbitAngle(t);
      dir.set(Math.cos(orbit) * 90, Math.sin(orbit) * 90, 20).normalize();
      sun.position.set(
        CENTER_X + dir.x * RADIUS,
        dir.y * RADIUS,
        CENTER_Z + dir.z * RADIUS,
      );
      moon.position.set(
        CENTER_X - dir.x * RADIUS,
        -dir.y * RADIUS,
        CENTER_Z - dir.z * RADIUS,
      );
      sun.visible = sunElevation(t) > -0.05;
      moon.visible = moonElevation(t) > -0.05;
      starMat.opacity = starAlpha(t);
      // Wheel the star field with the sky (sun rises east, sets west).
      stars.rotation.z = Math.PI / 2 - orbit;
    },
  };
}
