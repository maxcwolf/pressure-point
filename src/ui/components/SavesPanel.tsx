// The saved-games list, shared by the title screen and the pause menu.

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
import { storeThumb } from '../../storage/thumbnails';
import { css } from '../../styled-system/css';
import { dangerButton, fileButton, goButton } from '../../styled-system/recipes';
import { download } from '../dom';
import { cx } from '../lib/cx';

export interface SavesPanelProps {
  /** The game in progress, if there is one to save. */
  current?: GameState | undefined;
  /** A picture of the game in progress, kept with each save of it. */
  snapshot?: (() => string) | undefined;
  onLoad: (id: string) => void;
}

/** A line of feedback under the save box. */
interface Note {
  text: string;
  bad: boolean;
}

/** The panel: a box to save the game in progress, the saved games, and a way to import one. */
const panel = css({ textAlign: 'left', m: '0', mt: '10', mb: '4' });

/** The box to name the game in progress in, and its button. */
const saveNew = css({ display: 'flex', gap: '8', mb: '8' });

/** The box for a save's name. */
const nameBox = css({
  flex: '1',
  minW: '[0]',
  font: 'inherit',
  fontSize: '15',
  color: 'fg',
  bg: 'bg.card',
  border: 'outline',
  borderRadius: '12',
  py: '6',
  px: '12',
  userSelect: 'text',
  WebkitUserSelect: 'text',
});

/** A button on the panel: green to load or save, red to delete, and cream for the rest. */
const button = css.raw({
  pointerEvents: 'auto',
  border: 'outline.thin',
  borderRadius: '10',
  py: '2',
  px: '10',
  fontSize: '13',
  fontWeight: 'bold',
  bg: 'control',
  m: '0',
  boxShadow: '[0 2px 0 {colors.shadow}]',
  '&.go': { bg: 'go', color: 'fg.on-accent' },
  '&.danger': { bg: 'bad.bg', color: 'bad' },
});
const rowButton = css(button);

/** Save game, as big as the box beside it. */
const saveButton = css(button, { fontSize: '15', py: '6', px: '16' });

/**
 * What the last thing done came to, in green, or in red where it went wrong. Its size holds in a dialog too, which
 * draws its words larger.
 */
const noteLook = css({
  fontSize: '14 !important',
  bg: 'good.bg',
  color: 'good',
  borderRadius: '10',
  py: '4',
  px: '10',
  mb: '8',
  '&.bad': { bg: 'bad.bg', color: 'bad' },
});

/** The saved games, scrolling once there are more than fit. */
const list = css({
  listStyle: 'none',
  p: '0',
  maxH: '[calc(var(--vh) * 0.4)]',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
});

/** A saved game, with its buttons at the right. */
const row = css.raw({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10',
  bg: 'bg.card',
  border: 'card',
  borderRadius: '12',
  py: '6',
  px: '10',
});
const saveRow = css(row);

/** The row there is while there are no saved games. */
const emptyRow = css(row, { justifyContent: 'center', opacity: '[0.7]', fontSize: '14' });

/** What a saved game is: its name, over its date, money, stars and when it was saved. */
const about = css({ minW: '[0]' });
const aboutName = css({
  display: 'block',
  fontWeight: 'bold',
  fontSize: '15',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const aboutFacts = css({ fontSize: '12', opacity: '[0.75]' });

/** A saved game's buttons. */
const actions = css({ display: 'flex', gap: '4', flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' });

/** Importing a save file, and how many named saves there is room for. */
const foot = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10',
  mt: '8',
  fontSize: '12',
  opacity: '[0.85]',
});

/** Whether a save is a named slot rather than the autosave or the previous game. */
const isSlot = (i: SaveInfo) => i.id !== AUTOSAVE_ID && i.id !== PREVIOUS_ID;

const FULL: Note = {
  text: `Could not save. There is room for ${MAX_SAVES} named saves and limited browser storage: delete or export some first.`,
  bad: true,
};

/** The list of saved games, with saving, loading, exporting, importing and deleting. */
export function SavesPanel({ current, snapshot, onLoad }: SavesPanelProps) {
  const [draft, setDraft] = useState(current ? defaultSaveName(current) : '');
  const [note, setNote] = useState<Note | null>(null);
  /** The save whose Delete has been pressed once and is waiting to be pressed again. */
  const [confirming, setConfirming] = useState('');
  // read once and again after each change, not on every redraw: reading the list reads every save in it
  const [saves, setSaves] = useState(listSaves);
  /** Read the list of saves again after changing it. */
  const reread = () => {
    setSaves(listSaves());
  };

  /** Save the current game to a new slot, or over an existing one, and note the result. */
  const save = (id?: string) => {
    if (!current) return;
    const existing = id ? saves.find((s) => s.id === id) : undefined;
    const result = writeSave(current, existing ? existing.name : draft, id);
    if (typeof result !== 'string' && snapshot) storeThumb(result.id, snapshot());
    reread();
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
    reread();
    setConfirming('');
    setNote(null);
  };
  /** Read a save file the player picked and add it to the list. */
  const importFrom = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // empty the input, or picking the same file again would not count as a change and nothing would happen
    input.value = '';
    if (!file) return;
    void file.text().then((text) => {
      const result = importSave(text);
      reread();
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
      // `saves`, `save-note`, `bad`, `save-list` and `filebtn` are for the tests, and `save-list` for the scroll cues
      class={cx('saves', panel)}
      onKeyDown={(e) => {
        // typing a name must not trigger the game's keyboard shortcuts
        e.stopPropagation();
      }}
    >
      {current && (
        <div class={saveNew}>
          <input
            class={nameBox}
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
            class={cx(goButton(), saveButton)}
            onClick={act(() => {
              save();
            })}
          >
            Save game
          </button>
        </div>
      )}{' '}
      {note && <p class={cx('save-note', noteLook, note.bad && 'bad')}>{note.text}</p>}{' '}
      <ul class={cx('save-list', list)}>
        {saves.length ? (
          saves.map((s) => (
            <li key={s.id} class={saveRow} data-id={s.id}>
              <div class={about}>
                <b class={aboutName}>{s.name}</b>{' '}
                <span class={aboutFacts}>
                  {gameDate(s.day, s.startMonth)} · {money(s.money)} · {'★'.repeat(s.stars) || 'no stars'} · {s.healed}{' '}
                  healed · saved {timeAgo(s.savedAt)}
                </span>
              </div>{' '}
              <div class={actions}>
                <button
                  class={cx(goButton(), rowButton)}
                  onClick={() => {
                    onLoad(s.id);
                  }}
                >
                  Load
                </button>
                {current && isSlot(s) && (
                  <button
                    class={rowButton}
                    onClick={act(() => {
                      save(s.id);
                    })}
                  >
                    Overwrite
                  </button>
                )}{' '}
                <button
                  class={rowButton}
                  onClick={act(() => {
                    exportTo(s.id);
                  })}
                >
                  Export
                </button>
                <button
                  class={cx(dangerButton(), rowButton)}
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
          <li class={emptyRow}>No saved games yet.</li>
        )}
      </ul>{' '}
      <div class={foot}>
        <label class={fileButton()}>
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
