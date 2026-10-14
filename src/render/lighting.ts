// The light everything is drawn in: a soft sky and a warm sun that casts shadows.

import * as THREE from 'three';

/** Light a scene with the game's sky and sun, and return the sun so it can follow the camera. */
export function addLights(scene: THREE.Scene, shadowReach = 26): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b99a, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowReach;
  sc.right = shadowReach;
  sc.top = shadowReach;
  sc.bottom = -shadowReach;
  sc.near = 1;
  sc.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

/** Put the sun where it sits relative to the point the camera looks at. */
export function placeSun(sun: THREE.DirectionalLight, target: THREE.Vector3) {
  sun.position.set(target.x - 16, 30, target.z + 9);
  sun.target.position.copy(target);
}
