// The title screen: continue, load, start a new game or change the settings.

import './TitleScreen.css';

import { useState } from 'preact/hooks';

import type { Audio } from '../../audio';
import { TITLE_LINES } from '../../core/data';
import { gameDate, latestSave } from '../../storage/saves';
import { useRedraw } from '../hooks/use-redraw';
import { cx } from '../lib/cx';
import { SavesPanel } from './SavesPanel';
import { SettingsPanel } from './SettingsPanel';

export interface TitleScreenProps {
  audio: Audio;
  /** Quit the desktop app. Undefined in a browser, where there is nothing to quit. */
  exit: (() => void) | undefined;
  /** Called with 'new', or the id of a save to load. */
  onPick: (what: string) => void;
}

type Panel = 'saves' | 'settings';

/** The game's name and the ways into it. */
export function TitleScreen({ audio, exit, onPick }: TitleScreenProps) {
  const redraw = useRedraw();
  /** The panel showing under the buttons. The two share the space, one at a time. */
  const [showing, setShowing] = useState<Panel | null>(null);
  /** Panels that have been opened stay in place while hidden, so they keep what was typed into them. */
  const [opened, setOpened] = useState<readonly Panel[]>([]);
  const latest = latestSave();
  /** Show a panel, or hide it if it is the one showing. */
  const toggle = (panel: Panel) => {
    setShowing(showing === panel ? null : panel);
    if (!opened.includes(panel)) setOpened([...opened, panel]);
  };
  /** Flip a sound switch. A click is what browsers need before any sound, so music can start right here. */
  const flip = (change: () => void) => () => {
    audio.unlock();
    change();
    audio.play('blip');
    redraw();
  };
  return (
    <>
      <div class="title-sys">
        <button
          class={cx('round small', !audio.sound && 'off')}
          title="Sound effects"
          aria-pressed={audio.sound ? 'true' : 'false'}
          onClick={flip(() => {
            audio.toggleSound();
          })}
        >
          {audio.sound ? '🔊' : '🔇'}
        </button>{' '}
        <button
          class={cx('round small', !audio.music && 'off')}
          title="Music"
          aria-pressed={audio.music ? 'true' : 'false'}
          onClick={flip(() => {
            audio.toggleMusic();
          })}
        >
          🎵
        </button>
      </div>
      <div class="panel dialog wide">
        <div class="logo">
          {TITLE_LINES.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>{' '}
        <div class="btnrow">
          {latest && (
            <>
              <button
                class="go"
                title={`${latest.name}, ${gameDate(latest.day)}`}
                onClick={() => {
                  onPick(latest.id);
                }}
              >
                Continue
              </button>
              <button
                onClick={() => {
                  toggle('saves');
                }}
              >
                Load game
              </button>
            </>
          )}{' '}
          <button
            class={latest ? '' : 'go'}
            onClick={() => {
              onPick('new');
            }}
          >
            New game
          </button>{' '}
          <button
            onClick={() => {
              toggle('settings');
            }}
          >
            Settings
          </button>{' '}
          {exit && (
            <button class="danger" onClick={exit}>
              Exit
            </button>
          )}
        </div>{' '}
        {latest && (
          <p class="sub">
            Continue picks up "{latest.name}" at {gameDate(latest.day)}.
          </p>
        )}{' '}
        <div id="title-saves" hidden={showing !== 'saves'}>
          {opened.includes('saves') && <SavesPanel onLoad={onPick} />}
        </div>{' '}
        <div id="title-settings" hidden={showing !== 'settings'}>
          {opened.includes('settings') && <SettingsPanel audio={audio} onChange={redraw} />}
        </div>{' '}
        <p class="sub">Massage and acupuncture are open for business. Reiki is still limbering up.</p>
      </div>
    </>
  );
}
