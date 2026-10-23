// The title screen: the logo, the latest save, and the ways into the game, over a blurred view of it.

import './TitleScreen.css';

import { useEffect, useState } from 'preact/hooks';

import type { Audio } from '../../audio/audio';
import { CENTERS, GAME_TITLE } from '../../core/data';
import { latestSave, timeAgo } from '../../storage/saves';
import { loadDisciplinePrefs } from '../../storage/settings';
import { readThumb } from '../../storage/thumbnails';
import { useRedraw } from '../hooks/use-redraw';
import type { FullScreenSwitch, UpdateOffer } from '../host';
import { cx } from '../lib/cx';
import { saveFacts, titleBadges, updateNote } from '../lib/title';
import backdrop from '../theme/backdrop.jpg';
import logo from '../theme/logo.png';
import { CampaignPanel } from './CampaignPanel';
import { ChangelogPanel } from './ChangelogPanel';
import { Icon, IconText } from './common/Icon';
import { Dialog } from './dialogs/Dialog';
import { SandboxPanel } from './SandboxPanel';
import { SavesPanel } from './SavesPanel';
import { SettingsPanel } from './SettingsPanel';

export interface TitleScreenProps {
  audio: Audio;
  /** Quit the desktop app. Undefined in a browser, where there is nothing to quit. */
  exit: (() => void) | undefined;
  /** A newer version of the desktop app. Undefined in a browser, which always plays the latest. */
  update: UpdateOffer | undefined;
  /** Whether the desktop app's window fills the screen. Undefined in a browser. */
  fullScreen: FullScreenSwitch | undefined;
  /** Something the player needs to know, such as why the game they picked did not start. */
  note?: string;
  /** Called with 'new' for a sandbox game, 'new:<center>' for a campaign one, or the id of a save to load. */
  onPick: (what: string) => void;
}

type Panel = 'campaign' | 'sandbox' | 'saves' | 'settings' | 'changes';

/** The heading over each panel. */
const PANEL_NAMES: Readonly<Record<Panel, string>> = {
  campaign: 'Campaign',
  sandbox: 'Sandbox',
  saves: 'Load game',
  settings: 'Settings',
  changes: 'What’s new',
};

/** The logo, the latest save and the ways into the game. */
export function TitleScreen({ audio, exit, update, fullScreen, note = '', onPick }: TitleScreenProps) {
  const redraw = useRedraw();
  /** The panel showing under the logo in place of the menu, if any. */
  const [showing, setShowing] = useState<Panel | null>(null);
  /** Panels that have been opened stay in place while hidden, so they keep what was typed into them. */
  const [opened, setOpened] = useState<readonly Panel[]>([]);
  /** Whether the player is being asked to restart for the downloaded update. */
  const [askingToUpdate, setAskingToUpdate] = useState(false);
  const latest = latestSave();
  // the look for an update goes on while the title screen is up, and can end in one finishing downloading
  useEffect(() => update?.subscribe(redraw), [update, redraw]);
  const updateVersion = update?.ready();
  const updateStatus = update?.status();
  const updateLine = updateStatus && updateNote(updateStatus);
  /** Show a panel in place of the menu. */
  const open = (panel: Panel) => {
    setShowing(panel);
    if (!opened.includes(panel)) setOpened([...opened, panel]);
  };
  // Esc goes back from a panel to the menu
  useEffect(() => {
    /** Close the panel, or the question about updating, on Esc. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowing(null);
      setAskingToUpdate(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
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
          <Icon id={audio.sound ? 'ui-sound' : 'ui-mute'} size={22} />
        </button>{' '}
        <button
          class={cx('round small', !audio.music && 'off')}
          title="Music"
          aria-pressed={audio.music ? 'true' : 'false'}
          onClick={flip(() => {
            audio.toggleMusic();
          })}
        >
          <Icon id="ui-music" size={22} />
        </button>
      </div>
      <div class="title-stack">
        <h1 class="title-logo">
          <img src={logo} alt={GAME_TITLE} />
        </h1>
        <div class={cx('title-panel', showing && 'has-sub')}>
          {note && (
            <p class="title-note" role="alert">
              {note}
            </p>
          )}
          {showing && (
            <div class="title-sub-head">
              <button
                class="title-back"
                onClick={() => {
                  setShowing(null);
                }}
              >
                ‹ Back
              </button>
              <h2>{PANEL_NAMES[showing]}</h2>
            </div>
          )}
          {!showing && latest && (
            <div class="save-card">
              <h2>{latest.name}</h2>
              {latest.center && latest.center !== 'sandbox' && <p class="center-name">{CENTERS[latest.center].name}</p>}
              <div class="save-card-body">
                {picture ? (
                  <img class="save-thumb" src={picture} alt="" />
                ) : (
                  <div class="save-thumb empty">
                    <Icon id="ui-treatments" size={48} />
                  </div>
                )}
                <ul>
                  {saveFacts(latest).map((f) => (
                    <li key={f.icon}>
                      <Icon id={f.icon} size={20} />
                      {f.text}
                    </li>
                  ))}
                  <li class="saved-at">{`Saved ${timeAgo(latest.savedAt)}`}</li>
                </ul>
              </div>
            </div>
          )}
          <div class="title-buttons" hidden={!!showing}>
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
                  onClick={() => {
                    open('saves');
                  }}
                >
                  Load game
                </button>
              </>
            )}
            <button
              class="title-btn"
              onClick={() => {
                open('campaign');
              }}
            >
              Campaign
            </button>
            <button
              class="title-btn"
              title="A center of your own, with no deadline"
              onClick={() => {
                open('sandbox');
              }}
            >
              Sandbox
            </button>
            <button
              class="title-btn"
              onClick={() => {
                open('settings');
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
          <div id="title-campaign" class="title-sub" hidden={showing !== 'campaign'}>
            {opened.includes('campaign') && <CampaignPanel onStart={onPick} audio={audio} />}
          </div>
          <div id="title-sandbox" class="title-sub" hidden={showing !== 'sandbox'}>
            {opened.includes('sandbox') && (
              <SandboxPanel
                audio={audio}
                onStart={() => {
                  onPick('new');
                }}
              />
            )}
          </div>
          <div id="title-saves" class="title-sub" hidden={showing !== 'saves'}>
            {opened.includes('saves') && <SavesPanel onLoad={onPick} />}
          </div>
          <div id="title-settings" class="title-sub" hidden={showing !== 'settings'}>
            {opened.includes('settings') && <SettingsPanel audio={audio} fullScreen={fullScreen} onChange={redraw} />}
          </div>
          <div id="title-changes" class="title-sub" hidden={showing !== 'changes'}>
            {opened.includes('changes') && <ChangelogPanel />}
          </div>
        </div>
        <p class="title-version">{`v${__APP_VERSION__}`}</p>
        <div class="title-corner">
          {update && updateVersion && (
            <button
              class="title-news title-update"
              title={`Version ${updateVersion} has downloaded`}
              onClick={() => {
                setAskingToUpdate(true);
              }}
            >
              <IconText id="ui-update">Update to the latest version</IconText>
            </button>
          )}
          {updateLine && (
            <p class={cx('title-update-note', updateStatus.state !== 'latest' && 'busy')} role="status">
              <IconText id={updateLine.icon}>{updateLine.text}</IconText>
            </p>
          )}
          <button
            class="title-news"
            hidden={showing === 'changes'}
            onClick={() => {
              open('changes');
            }}
          >
            <IconText id="ui-news">What’s new</IconText>
          </button>
        </div>
        <div class="title-tray" hidden={!!showing}>
          {badges.map((b) => (
            <span key={b.label} class={cx('title-badge', !b.on && 'off')} title={b.label} aria-label={b.label}>
              <Icon id={b.icon} size="62%" />
            </span>
          ))}
        </div>
      </div>
      {askingToUpdate && update && updateVersion && (
        <Dialog>
          <h2>Restart to update?</h2>
          <p>{`The game will close, install version ${updateVersion} and open again. Your saved games are kept.`}</p>{' '}
          <p class="sub">Or not now: it installs by itself the next time you quit.</p>{' '}
          <div class="btnrow">
            <button
              onClick={() => {
                setAskingToUpdate(false);
              }}
            >
              Not now
            </button>
            <button class="go" onClick={update.install}>
              Restart and update
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
