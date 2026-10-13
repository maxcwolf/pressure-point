// The saved-games list, shared by the title screen and the in-game menu.
import { money } from '../core/sim/sim';
import { type GameState } from '../core/state/types';
import {
  AUTOSAVE_ID,
  defaultSaveName,
  deleteSave,
  exportSave,
  gameDate,
  importSave,
  listSaves,
  MAX_SAVES,
  PREVIOUS_ID,
  type SaveInfo,
  timeAgo,
  writeSave,
} from '../saves';
import { escapeHtml } from '../util';

export interface SavesPanelOptions {
  /** The game in progress, if there is one to save. */
  current?: GameState;
  onLoad(id: string): void;
}

const esc = escapeHtml;
const isSlot = (i: SaveInfo) => i.id !== AUTOSAVE_ID && i.id !== PREVIOUS_ID;
const FULL = `Could not save. There is room for ${MAX_SAVES} named saves and limited browser storage: delete or export some first.`;

/** Fill an element with the save list and wire up its buttons. */
export function mountSaves(el: HTMLElement, opts: SavesPanelOptions) {
  let draft = opts.current ? defaultSaveName(opts.current) : '';
  let note: { text: string; bad: boolean } | null = null;
  let confirming = '';

  const render = () => {
    const saves = listSaves();
    const rows = saves
      .map((s) => {
        const overwrite =
          opts.current && isSlot(s) ? `<button data-save="overwrite" data-id="${s.id}">Overwrite</button>` : '';
        const del = confirming === s.id ? 'Really delete?' : 'Delete';
        return `<li data-id="${s.id}">
          <div class="save-what"><b>${esc(s.name)}</b>
            <span>${gameDate(s.day)} · ${money(s.money)} · ${'★'.repeat(s.stars) || 'no stars'} · ${s.healed} healed · saved ${timeAgo(s.savedAt)}</span></div>
          <div class="save-actions"><button class="go" data-save="load" data-id="${s.id}">Load</button>${overwrite}
            <button data-save="export" data-id="${s.id}">Export</button><button class="danger" data-save="delete" data-id="${s.id}">${del}</button></div></li>`;
      })
      .join('');
    el.innerHTML = `<div class="saves">
      ${opts.current ? `<div class="save-new"><input type="text" maxlength="60" value="${esc(draft)}" aria-label="Name for this save"><button class="go" data-save="new">Save game</button></div>` : ''}
      ${note ? `<p class="save-note ${note.bad ? 'bad' : ''}">${esc(note.text)}</p>` : ''}
      <ul class="save-list">${rows || '<li class="empty">No saved games yet.</li>'}</ul>
      <div class="save-foot"><label class="filebtn">Import a save file<input type="file" accept=".json,application/json" hidden></label>
        <span>${saves.filter(isSlot).length} of ${MAX_SAVES} named saves used. Export a save to back it up or move it between the browser and the app.</span></div>
    </div>`;
  };

  const save = (id?: string) => {
    if (!opts.current) return;
    const existing = id ? listSaves().find((s) => s.id === id) : undefined;
    const result = writeSave(opts.current, existing ? existing.name : draft, id);
    note = typeof result === 'string' ? { text: FULL, bad: true } : { text: `Saved "${result.name}".`, bad: false };
  };

  el.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.type === 'text') draft = input.value;
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      save();
      render();
    }
    // typing a name must not trigger the game's keyboard shortcuts
    e.stopPropagation();
  });
  el.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (input.type !== 'file' || !file) return;
    void file.text().then((text) => {
      const result = importSave(text);
      note =
        result === 'invalid'
          ? {
              text: `"${file.name}" is not a Pressure Point Institute save, or it is from a newer version of the game.`,
              bad: true,
            }
          : result === 'full'
            ? { text: FULL, bad: true }
            : { text: `Imported "${result.name}".`, bad: false };
      render();
    });
  });
  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-save]');
    if (!btn) return;
    const id = btn.dataset.id ?? '';
    const act = btn.dataset.save;
    if (act !== 'delete') confirming = '';
    if (act === 'load') {
      opts.onLoad(id);
      return;
    }
    if (act === 'new') save();
    else if (act === 'overwrite') save(id);
    else if (act === 'export') {
      const file = exportSave(id);
      if (file) {
        const url = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: file.filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        note = { text: `Exported as ${file.filename}.`, bad: false };
      }
    } else if (act === 'delete') {
      // ask once more before throwing a game away
      if (confirming === id) {
        deleteSave(id);
        confirming = '';
        note = null;
      } else confirming = id;
    }
    render();
  });
  render();
}
