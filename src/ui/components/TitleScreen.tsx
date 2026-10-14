// The title screen: the logo, the latest save, and the ways into the game, over a blurred view of it.

import './TitleScreen.css';

import { useState } from 'preact/hooks';

import type { Audio } from '../../audio';
import { GAME_TITLE } from '../../core/data';
import { latestSave, timeAgo } from '../../storage/saves';
import { loadDisciplinePrefs } from '../../storage/settings';
import { readThumb } from '../../storage/thumbnails';
import { useRedraw } from '../hooks/use-redraw';
import { cx } from '../lib/cx';
import { saveFacts, titleBadges } from '../lib/title';
import backdrop from '../theme/backdrop.jpg';
import logo from '../theme/logo.png';
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

/** The logo, the latest save and the ways into the game. */
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
  const badges = titleBadges((d) => loadDisciplinePrefs()[d] !== false);
  const picture = latest ? readThumb(latest.id) : null;
  return (
    <>
      <div class="title-backdrop" style={{ backgroundImage: `url(${picture ?? backdrop})` }} />
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
      <div class="title-stack">
        <h1 class="title-logo">
          <img src={logo} alt={GAME_TITLE} />
        </h1>
        <div class="title-panel">
          {latest && (
            <div class="save-card">
              <h2>{latest.name}</h2>
              <div class="save-card-body">
                {picture ? <img class="save-thumb" src={picture} alt="" /> : <div class="save-thumb empty">💆</div>}
                <ul>
                  {saveFacts(latest).map((f) => (
                    <li key={f.icon}>
                      <i>{f.icon}</i>
                      {f.text}
                    </li>
                  ))}
                  <li class="saved-at">{`Saved ${timeAgo(latest.savedAt)}`}</li>
                </ul>
              </div>
            </div>
          )}
          <div class="title-buttons">
            {latest && (
              <>
                <button
                  class="title-btn"
                  onClick={() => {
                    onPick(latest.id);
                  }}
                >
                  Continue
                </button>
                <button
                  class="title-btn"
                  aria-expanded={showing === 'saves' ? 'true' : 'false'}
                  onClick={() => {
                    toggle('saves');
                  }}
                >
                  Load game
                </button>
              </>
            )}
            <button
              class="title-btn"
              onClick={() => {
                onPick('new');
              }}
            >
              New game
            </button>
            <button
              class="title-btn"
              aria-expanded={showing === 'settings' ? 'true' : 'false'}
              onClick={() => {
                toggle('settings');
              }}
            >
              Settings
            </button>
            {exit && (
              <button class="title-btn" onClick={exit}>
                Exit
              </button>
            )}
          </div>
          <div id="title-saves" class="title-sub" hidden={showing !== 'saves'}>
            {opened.includes('saves') && <SavesPanel onLoad={onPick} />}
          </div>
          <div id="title-settings" class="title-sub" hidden={showing !== 'settings'}>
            {opened.includes('settings') && <SettingsPanel audio={audio} onChange={redraw} />}
          </div>
        </div>
        <div class="title-tray">
          {badges.map((b) => (
            <span key={b.label} class={cx('title-badge', !b.on && 'off')} title={b.label} aria-label={b.label}>
              {b.icon}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
