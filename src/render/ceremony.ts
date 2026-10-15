// How a ceremony looks as it goes on: where the dark cloud pulled out of a guest is, and the rest that moves over them.

import type { ItemParts } from './models/parts';

/** How far through an extraction the cloud has been pulled clear of the guest, and is shooed away. */
const SHOO_FROM = 0.75;

/**
 * Where the dark cloud is during an extraction, in the mat's own frame, and how big: it is drawn slowly up out of the
 * guest's chest toward the Shaman's hands at the side, then shooed off up and away, shrinking as it goes.
 */
export function cloudAt(progress: number): { x: number; y: number; z: number; scale: number } {
  const p = Math.max(0, Math.min(1, progress));
  if (p < SHOO_FROM) {
    const k = p / SHOO_FROM;
    return { x: -0.55 * k, y: 0.2 + 0.6 * k, z: -0.1, scale: 0.6 + 0.6 * k };
  }
  const k = (p - SHOO_FROM) / (1 - SHOO_FROM);
  return { x: -0.55 - 1.2 * k, y: 0.8 + 1.4 * k, z: -0.1 - 0.4 * k, scale: 1.2 * (1 - k) + 0.05 };
}

/** Move a ceremony's parts for this frame, by how far through it is and the time. */
export function animateCeremony(parts: Required<ItemParts>['ceremony'], progress: number, t: number, id: number) {
  const { spirit, cloud, steam, swirls } = parts;
  spirit.position.y = 0.95 + Math.sin(t * 2 + id) * 0.05;
  spirit.rotation.y = Math.sin(t * 0.7 + id) * 0.6;
  const c = cloudAt(progress);
  cloud.position.set(c.x, c.y + Math.sin(t * 9 + id) * 0.02, c.z);
  cloud.scale.setScalar(c.scale);
  // a cloud that does not want to go wriggles
  cloud.rotation.z = Math.sin(t * 14 + id) * 0.25;
  steam.children.forEach((p, i) => {
    const f = (t * 0.6 + i / steam.children.length + id * 0.1) % 1;
    p.position.y = f * 0.7;
    p.scale.setScalar(0.4 + f);
  });
  swirls.forEach((ring, i) => {
    ring.rotation.y = t * (i % 2 ? -1.4 : 0.9) + id;
    ring.scale.setScalar(1 + Math.sin(t * 2.3 + i) * 0.12);
  });
}
