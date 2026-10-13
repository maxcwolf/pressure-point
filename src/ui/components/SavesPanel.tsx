// The saved-games list, shared by the title screen and the pause menu.

import './SavesPanel.css';

import { useState } from 'preact/hooks';

import { money } from '../../core/format';
import type { GameState } from '../../core/state/types';
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
} from '../../storage/saves';
import { cx } from '../lib/cx';

export interface SavesPanelProps {
  /** The game in progress, if there is one to save. */
  current?: GameState | undefined;
  onLoad: (id: string) => void;
}

/** A line of feedback under the save box. */
interface Note {
  text: string;
  bad: boolean;
}

/** Whether a save is a named slot rather than the autosave or the previous game. */
const isSlot = (i: SaveInfo) => i.id !== AUTOSAVE_ID && i.id !== PREVIOUS_ID;

const FULL: Note = {
  text: `Could not save. There is room for ${MAX_SAVES} named saves and limited browser storage: delete or export some first.`,
  bad: true,
};

/** Hand a file to the browser to download. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

/** The list of saved games, with saving, loading, exporting, importing and deleting. */
export function SavesPanel({ current, onLoad }: SavesPanelProps) {
  const [draft, setDraft] = useState(current ? defaultSaveName(current) : '');
  const [note, setNote] = useState<Note | null>(null);
  /** The save whose Delete has been pressed once and is waiting to be pressed again. */
  const [confirming, setConfirming] = useState('');
  const saves = listSaves();

  /** Save the current game to a new slot, or over an existing one, and note the result. */
  const save = (id?: string) => {
    if (!current) return;
    const existing = id ? saves.find((s) => s.id === id) : undefined;
    const result = writeSave(current, existing ? existing.name : draft, id);
    setNote(typeof result === 'string' ? FULL : { text: `Saved "${result.name}".`, bad: false });
  };
  /** Write a save out as a file. */
  const exportTo = (id: string) => {
    const file = exportSave(id);
    if (!file) return;
    download(file.filename, file.text);
    setNote({ text: `Exported as ${file.filename}.`, bad: false });
  };
  /** Delete a save, but only on the second press. */
  const remove = (id: string) => {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    deleteSave(id);
    setConfirming('');
    setNote(null);
  };
  /** Read a save file the player picked and add it to the list. */
  const importFrom = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const result = importSave(text);
      if (result === 'invalid')
        setNote({
          text: `"${file.name}" is not a Pressure Point Institute save, or it is from a newer version of the game.`,
          bad: true,
        });
      else if (result === 'full') setNote(FULL);
      else setNote({ text: `Imported "${result.name}".`, bad: false });
    });
  };
  /** Do something other than deleting, which also cancels a delete that was waiting to be confirmed. */
  const act = (what: () => void) => () => {
    setConfirming('');
    what();
  };

  return (
    <div
      class="saves"
      onKeyDown={(e) => {
        // typing a name must not trigger the game's keyboard shortcuts
        e.stopPropagation();
      }}
    >
      {current && (
        <div class="save-new">
          <input
            type="text"
            maxLength={60}
            value={draft}
            aria-label="Name for this save"
            onInput={(e) => {
              setDraft(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <button
            class="go"
            onClick={act(() => {
              save();
            })}
          >
            Save game
          </button>
        </div>
      )}{' '}
      {note && <p class={cx('save-note', note.bad && 'bad')}>{note.text}</p>}{' '}
      <ul class="save-list">
        {saves.length ? (
          saves.map((s) => (
            <li key={s.id} data-id={s.id}>
              <div class="save-what">
                <b>{s.name}</b>{' '}
                <span>
                  {gameDate(s.day)} · {money(s.money)} · {'★'.repeat(s.stars) || 'no stars'} · {s.healed} healed · saved{' '}
                  {timeAgo(s.savedAt)}
                </span>
              </div>{' '}
              <div class="save-actions">
                <button
                  class="go"
                  onClick={() => {
                    onLoad(s.id);
                  }}
                >
                  Load
                </button>
                {current && isSlot(s) && (
                  <button
                    onClick={act(() => {
                      save(s.id);
                    })}
                  >
                    Overwrite
                  </button>
                )}{' '}
                <button
                  onClick={act(() => {
                    exportTo(s.id);
                  })}
                >
                  Export
                </button>
                <button
                  class="danger"
                  onClick={() => {
                    remove(s.id);
                  }}
                >
                  {confirming === s.id ? 'Really delete?' : 'Delete'}
                </button>
              </div>
            </li>
          ))
        ) : (
          <li class="empty">No saved games yet.</li>
        )}
      </ul>{' '}
      <div class="save-foot">
        <label class="filebtn">
          Import a save file
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              importFrom(e.currentTarget);
            }}
          />
        </label>{' '}
        <span>
          {saves.filter(isSlot).length} of {MAX_SAVES} named saves used. Export a save to back it up or move it between
          the browser and the app.
        </span>
      </div>
    </div>
  );
}
