// The icon sheet: a page for the dev server only, to judge the game's icons as a set. Open /icons.html. Every icon is
// shown at the sizes the interface uses, and every icon the scene draws is shown as a sprite among clay people and
// furniture, seen from the game's camera, so a glyph can be checked at the size a player sees it. Add ?still to stop
// everything moving, for pictures, and &camera=close (or far) to start from another distance.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '../ui/theme/tokens.css';
import './icons.css';

import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { ICON_IDS, type IconId, SCENE_ICON_IDS, type SceneIconId } from '../core/data';
import type { Look } from '../core/state/types';
import { addLights, placeSun } from '../render/lighting';
import { buildCharacter } from '../render/models/character';
import { iconTexture, loadIcons } from '../render/models/icons';
import { buildItem } from '../render/models/items';
import { poseChar } from '../render/pose';
import { H_TALL, WALL_T } from '../render/shared';
import { Icon } from '../ui/components/common/Icon';
import { demoGuest, demoStaff, LAB_LOOK } from './people';

/** What the page offers tests: whether the scene has been drawn with the atlas in. */
declare global {
  interface Window {
    iconSheet?: { ready: boolean };
  }
}

const params = new URLSearchParams(location.search);
const still = params.has('still');

/** Each family of icons, with what it is for and how it is colored. */
const FAMILIES: readonly (readonly [prefix: string, name: string, note: string])[] = [
  ['bubble', 'Speech bubbles', 'Faces in orange, warnings in red, money in gold, things on cream and sand'],
  ['marker', 'Markers', 'Over furniture and the squares it is used from: staff in teal, guests in orange'],
  ['room', 'Rooms', 'A teal plate with a cream pictogram, like a sign on the door'],
  ['role', 'Roles', 'An orange disc with the pictogram of the work'],
  ['discipline', 'Disciplines', 'The pictogram alone, in teal'],
  ['overlay', 'Overlays', 'The floor overlays, for the picker and its key'],
  ['ui', 'Interface', 'The HUD: build and system buttons, the stats bar and the speeds'],
  ['season', 'Seasons', 'Beside the date'],
  [
    'item',
    'Items',
    'Each piece of furniture as the player places it: cream and sand, with one accent for what it is made of',
  ],
  ['technique', 'Treatments', 'Each technique a discipline teaches, in teal as its discipline'],
  ['course', 'Courses', 'The general courses any member of staff can take, in orange as the people'],
  ['feeling', 'Feelings', 'What guests felt about their visit: faces in orange, things as themselves'],
  ['award', 'Awards', 'The year-end awards, on gold medals'],
  ['achievement', 'Achievements', 'The campaign achievements, on badges'],
  ['mishap', 'Mishaps', 'Power cuts, storms, freezes and wasps, in red'],
  ['standing', 'Standing', 'The center’s grades, from a back room to an institute'],
];

/** How far the camera sits from what it looks at: as close as the game lets it, as it starts, and a long way out. */
const DISTANCES = { close: 16, game: 41, far: 60 } as const;
type Distance = keyof typeof DISTANCES;
/** The distance the camera starts at: where the game starts, unless the address asks for another. */
const startDistance = (Object.keys(DISTANCES) as Distance[]).find((d) => d === params.get('camera')) ?? 'game';

/** Which way the scene shows its sprites: as the game is meant to, or all on their own, or all in bubbles. */
type Variant = 'game' | 'plain' | 'bubble';

/** Whether an icon is meant to be drawn plain in the scene: a sign or a marker rather than something said. */
const plainInGame = (id: SceneIconId) => !id.startsWith('bubble-');

/** One card on the sheet: an icon at 12 and 16 pixels, at 24 on cream and on a white row, on a HUD button, and at 48. */
function Card({ id }: { id: IconId }) {
  return (
    <figure class="card">
      <div class="sizes">
        <Icon id={id} size={12} />
        <Icon id={id} size={16} />
        <Icon id={id} size={24} />
        <span class="row">
          <Icon id={id} size={24} />
        </span>
        <span class="round">
          <Icon id={id} size={26} />
        </span>
        <Icon id={id} size={48} />
      </div>
      <figcaption>{id}</figcaption>
    </figure>
  );
}

/** A person in the scene, with a sprite over their head, as the game draws a speech bubble. */
function personWith(id: SceneIconId, x: number, z: number, i: number) {
  const look: Look = {
    ...LAB_LOOK,
    top: [0x2a9d8f, 0xf08a4b, 0x7a6fbf, 0xe5564d][i % 4] ?? 0x2a9d8f,
    sex: i % 2 ? 'male' : 'female',
  };
  const staff = i % 3 === 0;
  const rig = buildCharacter(look, staff ? 'receptionist' : undefined);
  const c = staff ? demoStaff(look, 'receptionist') : demoGuest(look, 'knotted');
  c.x = x;
  c.y = z;
  c.id = i;
  return { rig, c, sprite: rig.bubble, id };
}

/** The scene: every icon the scene draws, over people, walls, furniture and tiles, seen from the game's angle. */
function Scene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [distance, setDistance] = useState<Distance>(startDistance);
  const [variant, setVariant] = useState<Variant>('game');
  const world = useRef<{ setView: (d: Distance, v: Variant) => void } | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8cc98a);
    const sun = addLights(scene, 20).sun;
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
    const orbit = new OrbitControls(camera, el);
    orbit.enableDamping = !still;

    const bubbles = SCENE_ICON_IDS.filter((id) => id.startsWith('bubble-'));
    const signs = SCENE_ICON_IDS.filter((id) => id.startsWith('room-'));
    const markers = SCENE_ICON_IDS.filter((id) => !id.startsWith('bubble-') && !id.startsWith('room-'));
    const across = 12;
    const step = 1.5;
    const width = across * step;
    const rows = Math.ceil(bubbles.length / across);
    const depth = (rows + 3) * step;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 2, depth + 2),
      new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.set(width / 2 - step / 2, 0, depth / 2 - step);
    const grid = new THREE.GridHelper(Math.max(width, depth) + 2, Math.max(width, depth) + 2, 0xd9c9a8, 0xd9c9a8);
    grid.position.set(floor.position.x, 0.002, floor.position.z);
    scene.add(floor, grid);

    /** Every sprite and the icon it shows, so the variant can be changed. */
    const shown: { sprite: THREE.Sprite; id: SceneIconId }[] = [];
    // a back wall with each room's sign over a doorway in it, as the game hangs them
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.9 });
    signs.forEach((id, i) => {
      const x = i * step;
      for (const side of [-0.5, 0.5]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, H_TALL, WALL_T), wallMat);
        wall.position.set(x + side, H_TALL / 2, -step);
        wall.castShadow = true;
        scene.add(wall);
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.scale.setScalar(0.72);
      sprite.renderOrder = 9;
      sprite.position.set(x, H_TALL + 0.55, -step);
      scene.add(sprite);
      shown.push({ sprite, id });
    });
    // everyone with something to say
    const people = bubbles.map((id, i) => personWith(id, (i % across) * step, Math.floor(i / across) * step, i));
    for (const p of people) {
      scene.add(p.rig.group);
      shown.push({ sprite: p.sprite, id: p.id });
    }
    // markers over the squares furniture is used from, and over a massage table, at the heights the game uses
    const front = rows * step + step;
    const table = buildItem('massage_table');
    table.position.set(0, 0, front);
    scene.add(table);
    markers.forEach((id, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      const onItem = id === 'marker-broken' || id === 'marker-filthy';
      sprite.scale.setScalar(onItem ? 0.7 : 0.62);
      sprite.renderOrder = 11;
      sprite.position.set(
        onItem ? (id === 'marker-broken' ? -0.5 : 0.5) : 2 * step + i * step * 0.9,
        onItem ? 1.9 : 1.15,
        front,
      );
      scene.add(sprite);
      shown.push({ sprite, id });
    });

    let frame = 0;
    let t = 0;
    /** Fit the drawing to the canvas, pose everyone and draw a frame. */
    const draw = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (w && h && camera.aspect !== w / h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      for (const p of people) poseChar(p.rig, p.c, t, 1, null);
      placeSun(sun, orbit.target.clone().setY(0));
      renderer.render(scene, camera);
    };
    /** Draw a frame and ask for the next, while things move. */
    const loop = () => {
      t += 1 / 60;
      orbit.update();
      draw();
      frame = requestAnimationFrame(loop);
    };

    const middle = new THREE.Vector3(width / 2 - step, 0, depth / 2 - step);
    /** Put each sprite in or out of its bubble, and the camera at a distance. */
    const setView = (d: Distance, v: Variant) => {
      for (const { sprite, id } of shown) {
        sprite.material.map = iconTexture(id, v === 'game' ? plainInGame(id) : v === 'plain');
        sprite.material.needsUpdate = true;
        sprite.visible = true;
      }
      orbit.target.copy(middle);
      camera.position.copy(middle).addScaledVector(new THREE.Vector3(1, 1.2, 1).normalize(), DISTANCES[d]);
      orbit.update();
      // held still, a frame is drawn only when something changes, so a picture can be taken in software rendering
      if (still) draw();
    };
    world.current = { setView };
    if (still) orbit.addEventListener('change', draw);

    void loadIcons().then(() => {
      setView(startDistance, 'game');
      if (!still) frame = requestAnimationFrame(loop);
      window.iconSheet = { ready: true };
    });
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    world.current?.setView(distance, variant);
  }, [distance, variant]);

  return (
    <section class="scene">
      <canvas ref={canvas} />
      <div class="controls">
        <label>
          Camera
          <select value={distance} onChange={(e) => setDistance(e.currentTarget.value as Distance)}>
            <option value="close">As close as the game goes</option>
            <option value="game">Where the game starts</option>
            <option value="far">Far out</option>
          </select>
        </label>
        <label>
          Sprites
          <select value={variant} onChange={(e) => setVariant(e.currentTarget.value as Variant)}>
            <option value="game">As the game draws them</option>
            <option value="plain">All on their own</option>
            <option value="bubble">All in bubbles</option>
          </select>
        </label>
        <span class="hint">Drag to turn · scroll to zoom · right-drag to pan</span>
      </div>
    </section>
  );
}

/** The whole page: the sheet of every icon by family, then the scene. */
function Page() {
  return (
    <>
      <div class="sheet">
        <header>
          <h1>Icons</h1>
          <p>
            {`${ICON_IDS.length} icons, ${SCENE_ICON_IDS.length} of them drawn in the scene. `}
            Each card: 12 and 16 pixels (the small sheet), 24 on cream and on a white row, on a HUD button, and 48. The
            drawings are in src/ui/icons/, with simpler ones for small sizes in small/; run <code>yarn icons</code>{' '}
            after changing one.
          </p>
          <a href="/lab.html">Model lab</a>
        </header>
        {FAMILIES.map(([prefix, name, note]) => (
          <section key={prefix} class="family">
            <h2>
              {name} <small>{note}</small>
            </h2>
            <div class="cards">
              {ICON_IDS.filter((id) => id.startsWith(`${prefix}-`)).map((id) => (
                <Card key={id} id={id} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <h2 class="scene-title">
        In the scene <small>Speech bubbles over people, signs over doorways, markers over squares and furniture</small>
      </h2>
      <Scene />
    </>
  );
}

// a page of its own rather than the body, which the sprite sheet is put into
const root = document.createElement('div');
document.body.append(root);
render(<Page />, root);
