// The controls in the settings: edge scrolling, how often to autosave, and which key does what.

import { useLayoutEffect, useState } from 'preact/hooks';

import {
  AUTOSAVE_CHOICES,
  canBind,
  DEFAULT_KEYS,
  KEY_ACTIONS,
  type KeyAction,
  loadControls,
  rebind,
  saveControls,
} from '../../storage/controls';
import { css } from '../../styled-system/css';
import { useRedraw } from '../hooks/use-redraw';
import { cx } from '../lib/cx';
import { ACTION_NAMES, autosaveLabel, keyLabel, nextChoice } from '../lib/keys';
import { Icon } from './common/Icon';
import { choice, SettingRow } from './SettingRow';

/** A key, drawn as a key: press it, then the key to put in its place. It turns sand while it waits. */
const keycap = css({
  pointerEvents: 'auto',
  flex: 'none',
  minW: '[46px]',
  fontSize: '13',
  fontWeight: 'bold',
  bg: 'white',
  border: 'control',
  borderBottomWidth: '[3.5px]',
  borderRadius: '[7px]',
  p: '[2px 8px]',
  '&.waiting': { bg: 'sand' },
});

/** Reset the keys, as a link in the words under them. */
const link = css({
  pointerEvents: 'auto',
  border: '[none]',
  bg: '[none]',
  p: 'none',
  fontWeight: 'bold',
  textDecoration: 'underline',
});

export interface ControlSettingsProps {
  /** Called after any change, with a click. */
  onChange: () => void;
}

/** Edge scrolling, the autosave interval, and a key for each action, any of which can be set to another. */
export function ControlSettings({ onChange }: ControlSettingsProps) {
  const redraw = useRedraw();
  const prefs = loadControls();
  /** The action waiting for its new key to be pressed, if any. */
  const [waiting, setWaiting] = useState<KeyAction | null>(null);
  /** Keep a change and let everyone know. */
  const change = (next: typeof prefs) => {
    saveControls(next);
    redraw();
    onChange();
  };

  // while an action waits for its key, the next key pressed is for it, and nothing else hears it
  useLayoutEffect(() => {
    if (!waiting) return;
    /** Take the key pressed for the action waiting, or give up on Esc. */
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') setWaiting(null);
      else if (canBind(e.code)) {
        const now = loadControls();
        saveControls({ ...now, keys: rebind(now.keys, waiting, e.code) });
        setWaiting(null);
        onChange();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [waiting, onChange]);

  return (
    <>
      <h4>Controls</h4>
      <ul>
        <SettingRow
          icon="ui-compass"
          name="Edge scrolling"
          desc="Move the camera by holding the mouse at the edge of the screen."
          on={prefs.edgeScroll}
          onToggle={() => {
            change({ ...prefs, edgeScroll: !prefs.edgeScroll });
          }}
        />
        <li>
          <Icon id="ui-save" size={26} />
          <div>
            <b>Autosave</b>
            <span>The game is always saved as you leave it, too.</span>
          </div>{' '}
          <button
            class={choice}
            onClick={() => {
              change({ ...prefs, autosave: nextChoice(AUTOSAVE_CHOICES, prefs.autosave) });
            }}
          >
            {autosaveLabel(prefs.autosave)}
          </button>
        </li>
      </ul>
      <h4>Keys</h4>
      {/* `key-list` puts the keys in two columns, in the settings' look (SettingsPanel.tsx) */}
      <ul class="key-list">
        {KEY_ACTIONS.map((a) => (
          <li key={a}>
            <span>{ACTION_NAMES[a]}</span>
            <button
              class={cx(keycap, waiting === a && 'waiting')}
              aria-label={`${ACTION_NAMES[a]}: ${keyLabel(prefs.keys[a])}`}
              onClick={() => {
                setWaiting(waiting === a ? null : a);
              }}
            >
              {waiting === a ? 'Press a key' : keyLabel(prefs.keys[a])}
            </button>
          </li>
        ))}
      </ul>
      <p class="sub">
        Click a key, then press the one you want in its place. A key already in use swaps over. The arrow keys always
        move the camera, and Esc always cancels.{' '}
        <button
          class={link}
          onClick={() => {
            setWaiting(null);
            change({ ...prefs, keys: { ...DEFAULT_KEYS } });
          }}
        >
          Reset the keys
        </button>
      </p>
    </>
  );
}
