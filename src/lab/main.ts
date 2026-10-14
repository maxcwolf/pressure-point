// The model lab: a page for the dev server only, to look at any of the game's models on its own.
// Open /lab.html, or /lab.html?model=item:bench for one model. Add &still to stop everything moving, for pictures.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '../ui/theme/tokens.css';
import './lab.css';

import { must } from '../core/util';
import { SETTINGS } from '../render/setting';
import { CATALOG, type Group, type Model, scalePerson, type Specimen } from './catalog';
import { button, choice, type Control, toggle } from './controls';
import { Stage, type ViewName, VIEWS } from './stage';

/** What the page offers tests: whether the model on show has settled, and a way to show another. */
interface LabHandle {
  readonly ready: boolean;
  ids: readonly string[];
  show: (id: string) => void;
}

declare global {
  interface Window {
    lab?: LabHandle;
  }
}

const params = new URLSearchParams(location.search);
const still = params.has('still');

/** The lab-wide settings, kept as the model on show changes. */
const view = {
  spin: !still,
  animate: !still,
  wireframe: false,
  tiles: true,
  person: false,
  setting: 'park',
};

/** Frames left before the model on show counts as drawn, long enough for a person to settle into a pose. */
const SETTLE_FRAMES = 20;

/** Make an element with a class and some children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  e.append(...children);
  return e;
}

const canvas = el('canvas', 'stage');
const search = el('input', 'search');
search.type = 'search';
search.placeholder = 'Find a model';
search.setAttribute('aria-label', 'Find a model');
const list = el('nav', 'list');
const title = el('h1', 'title');
const meta = el('p', 'meta');
const modelPanel = el('div', 'controls');
const viewPanel = el('div', 'controls');
const panel = el(
  'details',
  'panel',
  el('summary', '', 'Settings'),
  el('h2', '', 'Model'),
  modelPanel,
  el('h2', '', 'View'),
  viewPanel,
  el('p', 'hint', 'Drag to turn · scroll to zoom · right-drag to pan · ↑ ↓ to step through'),
);

document.body.append(
  el('aside', 'sidebar', el('header', 'brand', 'Model lab'), search, list),
  el('main', 'main', canvas, el('div', 'caption', title, meta), panel),
);

// on a narrow screen the settings would cover the model, so they start folded away
panel.open = !matchMedia('(max-width: 760px)').matches;

const stage = new Stage(canvas);
let current: Specimen = CATALOG.find((s) => s.id === params.get('model')) ?? must(CATALOG[0], 'a model to show');
let model: Model;
let settling = SETTLE_FRAMES;
const buttons = new Map<string, HTMLButtonElement>();

/** A control on the page for one setting. It calls back once the setting has changed. */
function controlEl(c: Control, changed: (rebuild: boolean) => void): HTMLElement {
  if (c.kind === 'button') {
    const b = el('button', 'button', c.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      c.run();
      changed(c.rebuild);
    });
    return b;
  }
  const label = el('label', `control ${c.kind}`, el('span', '', c.label));
  if (c.kind === 'toggle') {
    const box = el('input');
    box.type = 'checkbox';
    box.checked = c.of[c.key] === true;
    box.addEventListener('change', () => {
      c.of[c.key] = box.checked;
      changed(c.rebuild);
    });
    label.prepend(box);
  } else if (c.kind === 'range') {
    const input = el('input');
    input.type = 'range';
    input.min = String(c.min);
    input.max = String(c.max);
    input.value = String(c.of[c.key]);
    const out = el('output', '', input.value);
    input.addEventListener('input', () => {
      c.of[c.key] = Number(input.value);
      out.textContent = input.value;
      changed(c.rebuild);
    });
    label.append(input, out);
  } else {
    const select = el('select');
    for (const [value, text] of c.options) select.append(new Option(text, value, false, value === c.of[c.key]));
    select.addEventListener('change', () => {
      c.of[c.key] = select.value;
      changed(c.rebuild);
    });
    label.append(select);
  }
  return label;
}

/** Fill a panel with controls. */
function fillPanel(panel: HTMLElement, controls: readonly Control[], changed: (rebuild: boolean) => void) {
  panel.replaceChildren(...controls.map((c) => controlEl(c, changed)));
  if (!controls.length) panel.append(el('p', 'none', 'Nothing to change on this one.'));
}

/** Build the model on show afresh, with the settings it was left at, and put it on the stage. */
function rebuild(reframe: boolean) {
  model = current.build();
  stage.show(model, current.footprint);
  fillPanel(modelPanel, model.controls, (again) => {
    if (again) rebuild(false);
  });
  if (reframe) stage.frame('game');
  settling = SETTLE_FRAMES;
}

/** Show a specimen: build it, frame it, mark it in the list and put it in the address. */
function select(s: Specimen) {
  current = s;
  stage.setPerson(view.person ? scalePerson() : null, s.footprint);
  rebuild(true);
  title.textContent = s.name;
  meta.textContent = `${s.id} · ${s.footprint[0]}×${s.footprint[1]} tiles`;
  for (const [id, b] of buttons) b.classList.toggle('on', id === s.id);
  buttons.get(s.id)?.scrollIntoView({ block: 'nearest' });
  const url = new URL(location.href);
  url.searchParams.set('model', s.id);
  history.replaceState(null, '', url);
  document.title = `${s.name} · Model lab`;
}

/** List every specimen under its group, leaving out those that do not match the search. */
function drawList() {
  const q = search.value.trim().toLowerCase();
  list.replaceChildren();
  buttons.clear();
  const groups = new Map<Group, Specimen[]>();
  for (const s of CATALOG) {
    if (q && !`${s.name} ${s.id}`.toLowerCase().includes(q)) continue;
    groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  }
  for (const [group, specimens] of groups) {
    list.append(el('h3', '', `${group} · ${specimens.length}`));
    for (const s of specimens) {
      const b = el('button', s.id === current.id ? 'entry on' : 'entry', s.name);
      b.type = 'button';
      b.addEventListener('click', () => select(s));
      buttons.set(s.id, b);
      list.append(b);
    }
  }
  if (!groups.size) list.append(el('p', 'none', 'No model matches.'));
}

/** Step to the next or previous model in the list as it is filtered now. */
function step(by: number) {
  const ids = [...buttons.keys()];
  if (!ids.length) return;
  const next = ids[(ids.indexOf(current.id) + by + ids.length) % ids.length];
  const s = CATALOG.find((x) => x.id === next);
  if (s) select(s);
}

/** Bring the stage into line with the lab-wide settings. */
function applyView() {
  stage.setTilesVisible(view.tiles);
  stage.setWireframe(view.wireframe);
  stage.setGround(SETTINGS[view.setting === 'seaside' ? 'seaside' : 'park'].ground);
}

let showingPerson = false;
/** Bring the stage into line with the lab-wide settings after one has changed. */
function viewChanged() {
  applyView();
  if (view.person !== showingPerson) {
    showingPerson = view.person;
    stage.setPerson(view.person ? scalePerson() : null, current.footprint);
    stage.frame('game');
  }
}

const VIEW_CONTROLS: Control[] = [
  toggle('Spin', view, 'spin'),
  toggle('Animate', view, 'animate'),
  toggle('Tiles', view, 'tiles'),
  toggle('Wireframe', view, 'wireframe'),
  toggle('Person for scale', view, 'person'),
  choice('Setting', view, 'setting', [
    ['park', 'Park'],
    ['seaside', 'Seaside'],
  ]),
  ...(Object.keys(VIEWS) as ViewName[]).map((name) =>
    button(name === 'game' ? 'Game angle' : `${name.charAt(0).toUpperCase()}${name.slice(1)}`, () => stage.frame(name)),
  ),
];

fillPanel(viewPanel, VIEW_CONTROLS, viewChanged);
search.addEventListener('input', drawList);
window.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  // menus and sliders use the arrow keys themselves
  if (e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type === 'range')) {
    return;
  }
  e.preventDefault();
  step(e.key === 'ArrowDown' ? 1 : -1);
});
new ResizeObserver(() => stage.resize()).observe(canvas);

applyView();
stage.resize();
drawList();
select(current);

window.lab = {
  /** Whether the model on show has been drawn and has settled. */
  get ready() {
    return settling === 0;
  },
  ids: CATALOG.map((s) => s.id),
  /** Show a model by its id. */
  show(id) {
    const s = CATALOG.find((x) => x.id === id);
    if (!s) throw new Error(`No model in the lab is called ${id}`);
    select(s);
  },
};

let t = 0;
let last = performance.now();
/** Draw a frame and ask for the next. */
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (view.animate) t += dt;
  // held still, everyone is put straight into their pose, so a picture comes out the same every time
  stage.render(t, dt, view.spin, still);
  if (settling > 0) settling--;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
