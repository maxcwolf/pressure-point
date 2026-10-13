import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';

import { Audio } from './audio';
import { BX0, BX1, BY0, BY1, ITEMS, ROOMS, W } from './data';
import { isClick, isDragging } from './input';
import { View } from './render/view';
import { archiveAutosave, autosave, AUTOSAVE_ID, readSave } from './saves';
import { loadDisciplinePrefs } from './settings';
import { Sim } from './sim';
import { type GameState, newGame } from './state';
import { Tools } from './tools';
import { showTitle, UI } from './ui/ui';
import { accessTile, itemDims } from './world';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new Audio();

async function boot() {
  // the lawn sign and welcome mat are drawn to canvas, so the font has to be ready first
  await Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('500 20px Fredoka')]).catch(() => {
    // the fallback font will do
  });
  // loading or restarting from inside a game reloads the page and leaves a note saying what to open
  let state = open(takeHandoff());
  while (!state) {
    const choice = await showTitle(audio, exitApp);
    audio.unlock();
    state = open(choice);
  }
  start(state);
}

/**
 * In the desktop app there is a window to close, so the game offers Exit.
 * A browser tab cannot close itself, so the web version leaves that to the browser.
 */
const exitApp = /\bElectron\//.test(navigator.userAgent) ? () => window.close() : undefined;

const HANDOFF_KEY = 'pressure-point-start';
function takeHandoff(): string | null {
  try {
    const what = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    return what;
  } catch {
    return null;
  }
}
function reloadInto(what: string) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, what);
  } catch {
    // without session storage the title screen appears instead, which is fine
  }
  location.reload();
}

/** Open a saved game by id, or a fresh one for 'new'. Null if there is nothing to open. */
function open(what: string | null): GameState | null {
  if (!what) return null;
  const state = what === 'new' ? newGame() : readSave(what);
  // a new game starts with the treatments chosen in Settings
  if (state && what === 'new') state.options = loadDisciplinePrefs();
  // the game being left behind moves to the "Previous game" slot rather than being overwritten
  if (state && what !== AUTOSAVE_ID) archiveAutosave();
  return state;
}

function start(state: GameState) {
  const sim = new Sim(state);
  // a blueprint still open when the game was last closed is torn up, with anything bought for it refunded
  for (const r of [...state.rooms]) if (!r.done) sim.removeRoom(r.id, 1);

  const view = new View(canvas, sim);
  let uiDirty = true;
  const tools = new Tools(
    sim,
    view,
    () => (uiDirty = true),
    (name) => audio.play(name),
  );
  const save = () => autosave(state);
  /** Leave this game for another one, keeping it up to date in the autosave first. */
  const leaveFor = (what: string) => {
    save();
    window.removeEventListener('beforeunload', save);
    reloadInto(what);
  };
  const ui = new UI({
    sim,
    tools,
    view,
    audio,
    save,
    newGame: () => leaveFor('new'),
    loadGame: (id) => leaveFor(id),
    // back to the title screen; the game is in the autosave, so Continue picks it straight up
    mainMenu: () => {
      save();
      window.removeEventListener('beforeunload', save);
      location.reload();
    },
    exit:
      exitApp &&
      (() => {
        save();
        exitApp();
      }),
  });

  // ---- Pointer input -------------------------------------------------------
  let down: { x: number; y: number; button: number; moved: boolean; at: number } | null = null;
  let last = { x: 0, y: 0 };
  const draggingRoom = () => tools.tool.kind === 'room' && tools.tool.phase === 'drag';

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, button: e.button, moved: false, at: performance.now() };
    last = { x: e.clientX, y: e.clientY };
    if (e.button === 0) {
      ui.closeMenu();
      tools.pointerDown(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (down) {
      if (isDragging(e.clientX - down.x, e.clientY - down.y)) down.moved = true;
      // with no tool in hand a left drag moves the camera, as do right and middle drags
      const pans = down.button !== 0 || (!tools.active && down.moved);
      if (pans && down.moved) view.panPixels(e.clientX - last.x, e.clientY - last.y);
    }
    last = { x: e.clientX, y: e.clientY };
    tools.pointerMove(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!d) return;
    const click = isClick(d.moved, performance.now() - d.at, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    if (d.button === 0) {
      if (click || draggingRoom()) tools.pointerUp(e.clientX, e.clientY);
    } else if (d.button === 2 && click) {
      if (tools.active) tools.back();
      else tools.select(null);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom(Math.max(-0.25, Math.min(0.25, e.deltaY * 0.0015)));
    },
    { passive: false },
  );

  // ---- Keyboard ------------------------------------------------------------
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (ui.blocking) {
      // Esc backs out of the pause menu and its dialogs
      if (k === 'escape') ui.dismiss();
      return;
    }
    keys.add(k);
    if (k === 'escape') {
      // Esc cancels whatever is in hand; with nothing in hand it opens the pause menu
      if (tools.active) tools.back();
      else if (ui.closeMenu()) void 0;
      else if (tools.selected) tools.select(null);
      else ui.openPauseMenu();
    } else if (k === 'enter') tools.planBuild();
    else if (k === 'r') tools.rotate();
    else if (k === ' ') {
      e.preventDefault();
      state.speed = state.speed === 0 ? 1 : 0;
    } else if (k === '1' || k === '2' || k === '3') state.speed = Number(k);
    uiDirty = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // ---- Main loop -----------------------------------------------------------
  let prev = performance.now();
  let uiT = 0;
  let saveT = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;

    if (!ui.blocking) {
      const pan = dt * view.dist * 0.55;
      if (keys.has('w') || keys.has('arrowup')) view.pan(0, pan);
      if (keys.has('s') || keys.has('arrowdown')) view.pan(0, -pan);
      if (keys.has('a') || keys.has('arrowleft')) view.pan(-pan, 0);
      if (keys.has('d') || keys.has('arrowright')) view.pan(pan, 0);
    }

    sim.tick(dt);
    view.render(dt);
    const events = sim.drain();
    if (events.length) {
      ui.handle(events);
      uiDirty = true;
    }
    uiT += dt;
    if (uiDirty || uiT > 0.2) {
      uiT = 0;
      uiDirty = false;
      ui.update();
    }
    saveT += dt;
    if (saveT > 12) {
      saveT = 0;
      save();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', save);

  // a handle for the browser console and the end-to-end tests, in development builds only
  if (import.meta.env.DEV) {
    const data = { ITEMS, ROOMS, W, BX0, BX1, BY0, BY1 };
    Object.assign(window, { pp: { sim, view, tools, ui, state, data, geo: { itemDims, accessTile } } });
  }
}

void boot();
