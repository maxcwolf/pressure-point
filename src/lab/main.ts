// The model lab: a page for the dev server only, to look at any of the game's models on its own.
// Open /lab.html, or /lab.html?model=item:bench for one model. Add &still to stop everything moving, for pictures,
// and &view=head (or front, side, top) to start from another angle. Any of the model's settings can be given too, by
// the name it is kept under, such as &wear=85 or &inUse=1.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '../ui/theme/panda.css';

import { must } from '../core/util';
import { SETTINGS } from '../render/setting';
import { css } from '../styled-system/css';
import { cx } from '../ui/lib/cx';
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
/** The camera angle each model is framed from to begin with: the game's, unless the address asks for another. */
const startView = (Object.keys(VIEWS) as ViewName[]).find((v) => v === params.get('view')) ?? 'game';

/** The lab-wide settings, kept as the model on show changes. */
const view = {
  spin: !still,
  animate: !still,
  wireframe: false,
  tiles: true,
  person: false,
  setting: 'park' as keyof typeof SETTINGS,
};

/** Frames left before the model on show counts as drawn, long enough for a person to settle into a pose. */
const SETTLE_FRAMES = 20;

/**
 * The page: a list of models down the side, the stage beside it, and its settings over the stage, filling the window
 * in the game's font on cream. On a narrow screen the list goes over the stage.
 */
const pageStyle = css({
  '&, & *': { boxSizing: 'border-box' },
  '&, & body': { m: '0', h: '[100%]', overflow: 'hidden', bg: 'cream', fontFamily: 'body', color: 'navy' },
  '& body': {
    display: 'grid',
    gridTemplateColumns: '[260px 1fr]',
    _max760: { gridTemplateColumns: '[1fr]', gridTemplateRows: '[34vh 1fr]' },
  },
});

/** The side of the page with the lab's name, the search and the list; along the top, on a narrow screen. */
const sidebarStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minH: '[0]',
  borderRight: '[2px solid rgba(36, 56, 74, 0.12)]',
  bg: 'sand',
  _max760: { borderRight: '[0]', borderBottom: '[2px solid rgba(36, 56, 74, 0.12)]' },
});

/** The lab's name, over the search. */
const brandStyle = css({ p: '[16px 16px 8px]', fontSize: '[20px]', fontWeight: 'bold' });

/** The search box, in the page's font and color rather than the browser's. */
const searchStyle = css({
  font: 'inherit',
  color: 'inherit',
  m: '[0 16px 8px]',
  p: '[8px 12px]',
  border: '[2px solid rgba(36, 56, 74, 0.18)]',
  borderRadius: '[10px]',
  bg: 'white',
  _focusVisible: { outline: '[2px solid {colors.teal}]', outlineOffset: '[1px]' },
});

/** The list of models, scrolling on its own, with a small heading over each group. */
const listStyle = css({
  flex: '1',
  overflowY: 'auto',
  p: '[0 8px 16px]',
  '& h3': {
    m: '[14px 8px 4px]',
    fontSize: '[12px]',
    fontWeight: 'bold',
    letterSpacing: '[0.04em]',
    textTransform: 'uppercase',
    opacity: '[0.6]',
  },
});

/** A model in the list, in the page's font and color, and teal while it is the one on show. */
const entryStyle = css({
  font: 'inherit',
  color: 'inherit',
  display: 'block',
  w: '[100%]',
  p: '[5px 8px]',
  border: '[0]',
  borderRadius: '[8px]',
  bg: '[none]',
  textAlign: 'left',
  cursor: 'pointer',
  // shaded under the pointer, all but the one on show, which stays teal (Panda would put `_hover` after `_on`)
  '&:not(.on):hover': { bg: '[rgba(36, 56, 74, 0.07)]' },
  _on: { bg: 'teal', color: 'white' },
});

/** Words for when there is nothing to show: no model matches the search, or a model has nothing to change. */
const noneStyle = css({ m: '8', fontSize: '[14px]', opacity: '[0.6]' });

/** The stage's side of the page, with the caption and the settings over it. */
const mainStyle = css({ position: 'relative', minW: '[0]', minH: '[0]' });

/** The stage, the whole of its side of the page. */
const stageStyle = css({ display: 'block', w: '[100%]', h: '[100%]', touchAction: 'none' });

/** The model's name and id, over the top left of the stage, letting the pointer through to it. */
const captionStyle = css({
  position: 'absolute',
  top: '[16px]',
  left: '[16px]',
  p: '[8px 14px]',
  borderRadius: 'card',
  bg: '[rgba(255, 248, 234, 0.9)]',
  boxShadow: 'raised',
  pointerEvents: 'none',
});

/** The model's name. */
const titleStyle = css({ m: '0', fontSize: '[20px]', fontWeight: 'bold' });

/** The model's id and size, under its name. */
const metaStyle = css({ m: '[2px 0 0]', fontSize: '[13px]', opacity: '[0.7]', fontVariantNumeric: 'tabular-nums' });

/** The settings, over the top right of the stage, with a heading over each kind; along its foot, on a narrow screen. */
const panelStyle = css({
  position: 'absolute',
  top: '[16px]',
  right: '[16px]',
  w: '[250px]',
  maxH: '[calc(100% - 32px)]',
  overflowY: 'auto',
  p: '[4px 14px 12px]',
  borderRadius: 'card',
  bg: '[rgba(255, 248, 234, 0.94)]',
  boxShadow: 'raised',
  '& summary': { m: '[0 -14px]', p: '[8px 14px 4px]', fontSize: '[14px]', fontWeight: 'bold', cursor: 'pointer' },
  '& h2': {
    m: '[10px 0 6px]',
    fontSize: '[12px]',
    fontWeight: 'bold',
    letterSpacing: '[0.04em]',
    textTransform: 'uppercase',
    opacity: '[0.6]',
  },
  _max760: { top: 'auto', bottom: '[16px]', left: '[16px]', right: '[16px]', w: 'auto', maxH: '[60%]' },
});

/** The settings for the model or for the view, wrapping onto as many lines as they take. */
const controlsStyle = css({ display: 'flex', flexWrap: 'wrap', gap: '6' });

/**
 * A setting, the whole width of the panel: a switch and its name, or its name and a slider with its value or a menu.
 * The names before sliders and menus take the same room, so those line up.
 */
const controlStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8',
  w: '[100%]',
  fontSize: '[14px]',
  '&.range span, &.choice span': { flex: '[0 0 auto]', minW: '[64px]' },
  "& input[type='range'], & select": { flex: '1', minW: '[0]' },
  '& output': { w: 'control', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  "& input[type='checkbox'], & input[type='range']": { accentColor: 'teal' },
  '& select': { p: '[3px 6px]', border: '[2px solid rgba(36, 56, 74, 0.18)]', borderRadius: '[8px]', bg: 'white' },
  // in the page's font and color rather than the browser's
  '& input, & select': { font: 'inherit', color: 'inherit' },
});

/** A button among the settings, such as a camera angle, in the page's font and color, its edge teal under the pointer. */
const buttonStyle = css({
  font: 'inherit',
  color: 'inherit',
  p: '[4px 10px]',
  border: '[2px solid rgba(36, 56, 74, 0.18)]',
  borderRadius: '[8px]',
  bg: 'white',
  fontSize: '[14px]',
  cursor: 'pointer',
  _hover: { borderColor: 'teal' },
});

/** How to get round the stage, under the settings. */
const hintStyle = css({ m: '[12px 0 0]', fontSize: '[12px]', opacity: '[0.6]' });

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

// `stage`, `caption` and `lab-panel` are for the screenshot tests to find them by
const canvas = el('canvas', cx('stage', stageStyle));
const search = el('input', searchStyle);
search.type = 'search';
search.placeholder = 'Find a model';
search.setAttribute('aria-label', 'Find a model');
const list = el('nav', listStyle);
const title = el('h1', titleStyle);
const meta = el('p', metaStyle);
const modelPanel = el('div', controlsStyle);
const viewPanel = el('div', controlsStyle);
const panel = el(
  'details',
  cx('lab-panel', panelStyle),
  el('summary', '', 'Settings'),
  el('h2', '', 'Model'),
  modelPanel,
  el('h2', '', 'View'),
  viewPanel,
  el('p', hintStyle, 'Drag to turn · scroll to zoom · right-drag to pan · ↑ ↓ to step through'),
);

// the lab draws its own page, as the game's page-wide styles are kept to the game's
document.documentElement.className = pageStyle;
document.body.append(
  el('aside', sidebarStyle, el('header', brandStyle, 'Model lab'), search, list),
  el('main', mainStyle, canvas, el('div', cx('caption', captionStyle), title, meta), panel),
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
    const b = el('button', buttonStyle, c.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      c.run();
      changed(c.rebuild);
    });
    return b;
  }
  // its kind, so the names before sliders and menus can take the same room
  const label = el('label', cx(controlStyle, c.kind), el('span', '', c.label));
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
  if (!controls.length) panel.append(el('p', noneStyle, 'Nothing to change on this one.'));
}

/** Set the model's settings to any given in the address, for the first model shown. */
function settingsFromAddress(controls: readonly Control[]) {
  for (const c of controls) {
    if (c.kind === 'button') continue;
    const value = params.get(c.key);
    if (value === null) continue;
    c.of[c.key] = c.kind === 'range' ? Number(value) : c.kind === 'toggle' ? value !== '0' && value !== 'false' : value;
  }
}

let fromAddress = true;
/** Build the model on show afresh, with the settings it was left at, and put it on the stage. */
function rebuild(reframe: boolean) {
  model = current.build();
  if (fromAddress) settingsFromAddress(model.controls);
  fromAddress = false;
  stage.show(model, current.footprint);
  fillPanel(modelPanel, model.controls, (again) => {
    if (again) rebuild(false);
  });
  if (reframe) stage.frame(startView);
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
      const b = el('button', cx(entryStyle, s.id === current.id && 'on'), s.name);
      b.type = 'button';
      b.addEventListener('click', () => select(s));
      buttons.set(s.id, b);
      list.append(b);
    }
  }
  if (!groups.size) list.append(el('p', noneStyle, 'No model matches.'));
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
  stage.setGround(SETTINGS[view.setting]);
}

let showingPerson = false;
/** Bring the stage into line with the lab-wide settings after one has changed. */
function viewChanged() {
  applyView();
  if (view.person !== showingPerson) {
    showingPerson = view.person;
    stage.setPerson(view.person ? scalePerson() : null, current.footprint);
    stage.frame(startView);
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
    ['mountain', 'Mountain'],
    ['downtown', 'Downtown'],
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
