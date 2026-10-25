// The title screen: the logo, the latest save, and the ways into the game, over a blurred view of it.

import { useEffect, useState } from 'preact/hooks';

import type { Audio } from '../../audio/audio';
import { CENTERS, GAME_TITLE } from '../../core/data';
import { latestSave, timeAgo } from '../../storage/saves';
import { loadDisciplinePrefs } from '../../storage/settings';
import { readThumb } from '../../storage/thumbnails';
import { saveWelcomeSeen } from '../../storage/welcome';
import { css } from '../../styled-system/css';
import { buttonRow, goButton, roundButton } from '../../styled-system/recipes';
import { useRedraw } from '../hooks/use-redraw';
import type { FullScreenSwitch, UpdateOffer } from '../host';
import { cx } from '../lib/cx';
import { saveFacts, titleBadges, updateNote } from '../lib/title';
import backdrop from '../theme/backdrop.jpg';
import logo from '../theme/logo.png';
import { CampaignPanel } from './CampaignPanel';
import { ChangelogPanel } from './ChangelogPanel';
import { Icon, IconText } from './common/Icon';
import { ScrollTab } from './common/ScrollTab';
import { Dialog } from './dialogs/Dialog';
import { FeedbackPanel } from './FeedbackPanel';
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
  /** Whether to welcome the player to the alpha, which they see once. */
  welcome?: boolean;
  /** Called with 'new' for a sandbox game, 'new:<center>' for a campaign one, or the id of a save to load. */
  onPick: (what: string) => void;
}

// Everything is sized from the window's height, so the menu fits a short window without scrolling. A panel takes the
// menu's place under the logo, and scrolls within itself when it is long. The screen itself, and the height of the logo
// that so much is sized by, are on the element ui/index.tsx makes for it.

/** The latest game, or a center in full swing, blurred and dimmed behind everything. */
const backdropLook = css({
  position: 'fixed',
  inset: '[-40px]',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  filter: '[blur(14px) brightness(0.72) saturate(0.85)]',
  '&::after': { content: "''", position: 'absolute', inset: '[0]', bg: '[rgba(46, 66, 92, 0.35)]' },
});

/** The logo and everything under it, in the middle of the window. */
const stack = css({
  position: 'relative',
  m: '[auto 0]',
  w: '[min(620px, 100%)]',
  maxH: '[100%]',
  minH: '[0]',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

/** The logo, over the top of the panel. */
const logoLook = css({
  position: 'relative',
  zIndex: '[1]',
  m: 'none',
  flex: 'none',
  lineHeight: '[0]',
  textAlign: 'center',
});

/** The logo's picture, as tall as --logo-h, which ui/index.tsx sets. */
const logoPicture = css({ h: '[var(--logo-h)]', w: 'auto', maxW: '[100%]', objectFit: 'contain' });

/** The dark panel, tucked up under the bottom of the logo. */
const panelLook = css({
  w: '[min(530px, 100%)]',
  minH: '[0]',
  mt: '[calc(var(--logo-h) * -0.33)]',
  p: '[calc(var(--logo-h) * 0.28) clamp(14px, 3vh, 26px) clamp(10px, 2.2vh, 22px)]',
  borderRadius: '[22px]',
  bg: '[rgba(44, 58, 78, 0.84)]',
  color: 'white',
  textAlign: 'center',
  overflowY: 'auto',
  // with a panel open, its header stays put and the panel below it scrolls
  '&.has-sub': { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
});

/** The header over an open panel: Back at the left, and the panel's name in the middle. */
const subHead = css({
  display: 'grid',
  gridTemplateColumns: '[1fr auto 1fr]',
  alignItems: 'center',
  mb: '[10px]',
  flex: 'none',
});

/** The open panel's name. */
const subName = css({ fontSize: '[clamp(20px, 3.4vh, 26px)]', fontWeight: 'bold' });

/** Back, from a panel to the menu. */
const back = css({
  justifySelf: 'start',
  border: '[2.5px solid {colors.white}]',
  borderRadius: '[11px]',
  bg: '[#19bcd6]',
  color: 'white',
  fontSize: '15',
  fontWeight: 'bold',
  p: '[4px 12px 4px 9px]',
  _hover: { bg: '[#33cbe3]' },
});

/** Something the player needs to know, in red. */
const noteLook = css({
  bg: 'bad-bg',
  color: '[#8f2a24]',
  border: '[2px solid {colors.bad}]',
  borderRadius: 'card',
  p: '[9px 12px]',
  mb: '[14px]',
  fontSize: '15',
  lineHeight: '[1.35]',
  textAlign: 'left',
});

/** The latest save's name. */
const saveName = css({ fontSize: '[clamp(18px, 3.2vh, 24px)]', fontWeight: 'bold', mb: '[clamp(4px, 1vh, 10px)]' });

/** The center the latest save is in, close under its name. */
const centerName = css({ m: '[-8px 0 8px]', fontSize: '14', color: '[#7fe6f2]', fontWeight: 'bold' });

/** The latest save's picture beside its facts. */
const saveBody = css({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '[clamp(12px, 2vh, 18px)]',
  mb: '[clamp(8px, 1.8vh, 16px)]',
  // a little room at the sides, so the picture never presses against the edge of the panel
  p: '[0 clamp(6px, 1.4vh, 12px)]',
  textAlign: 'left',
});

/** The latest save's picture of its game, framed in white. */
const thumb = css.raw({
  h: '[clamp(56px, 10vh, 100px)]',
  aspectRatio: '[1.6]',
  flex: 'none',
  objectFit: 'cover',
  border: '[4px solid {colors.white}]',
  borderRadius: '[8px]',
  bg: '[#5c708a]',
});
const thumbPicture = css(thumb);

/** The frame with an icon in it, for a save with no picture. */
const noPicture = css(thumb, {
  display: 'grid',
  placeItems: 'center',
  '& .icon': { bg: 'cream', p: 'xs', borderRadius: 'card' },
});

/** The facts about the latest save, in two columns to keep the card short. */
const facts = css({
  listStyle: 'none',
  p: 'none',
  display: 'grid',
  gridTemplateColumns: '[auto auto]',
  columnGap: '[16px]',
  minW: '[0]',
  fontSize: '[clamp(13px, 2.2vh, 15.5px)]',
  fontWeight: 'bold',
  lineHeight: '[1.4]',
  rowGap: '[3px]',
  // icons on the dark panel sit on cream chips, or their navy outlines would vanish
  '& .icon': { bg: 'cream', borderRadius: '[6px]', p: '[1.5px]' },
});

/** A fact: a long one, like a late date, wraps within its own column, lined up under its text rather than its icon. */
const factLook = css.raw({
  display: 'grid',
  gridTemplateColumns: '[1.7em auto]',
  alignItems: 'start',
  '& > .icon': { mr: '[0.45em]' },
});
const fact = css(factLook);

/** When the latest save was made, smaller, across both columns and lined up with the facts' words. */
const savedAt = css(factLook, {
  gridColumn: '[1 / -1]',
  display: 'block',
  fontSize: '[0.82em]',
  color: '[#7fe6f2]',
  pl: '[1.7em]',
});

/** The menu: one button under another. */
const menu = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '[clamp(4px, 0.9vh, 9px)]',
  '&[hidden]': { display: 'none' },
});

/** A button on the menu, big and bright. */
const menuButton = css({
  flex: 'none',
  h: '[clamp(34px, 6vh, 52px)]',
  border: '[3px solid {colors.white}]',
  borderRadius: '[14px]',
  bg: '[#19bcd6]',
  color: 'white',
  fontSize: '[clamp(17px, 3.2vh, 25px)]',
  fontWeight: 'bold',
  textShadow: '[0 2px 0 rgba(20, 60, 80, 0.35)]',
  boxShadow: '[0 4px 0 rgba(0, 0, 0, 0.25)]',
  transition: '[transform 0.08s]',
  _hover: { bg: '[#33cbe3]', transform: 'translateY(-1px)' },
  _active: { transform: 'translateY(2px)', boxShadow: '[0 2px 0 rgba(0, 0, 0, 0.25)]' },
});

/** A panel is a light card of its own, scrolling when it is longer than the window allows. */
const sub = css({
  minH: '[0]',
  overflowY: 'auto',
  p: '[12px 14px]',
  borderRadius: '[14px]',
  bg: 'cream',
  color: 'navy',
  textAlign: 'center',
});

/** The tray under the menu, with a badge for each treatment. */
const tray = css({
  flex: 'none',
  display: 'flex',
  justifyContent: 'center',
  gap: '[clamp(10px, 2vh, 18px)]',
  mt: '[clamp(6px, 1.4vh, 16px)]',
  p: '[clamp(6px, 1.2vh, 12px) 28px]',
  borderRadius: '[18px]',
  bg: '[rgba(44, 58, 78, 0.78)]',
  '&[hidden]': { display: 'none' },
});

/** A treatment's badge, greyed while it is off for new games. */
const badge = css({
  w: '[clamp(36px, 6.4vh, 58px)]',
  h: '[clamp(36px, 6.4vh, 58px)]',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '[50%]',
  border: '[3px solid {colors.white}]',
  bg: 'cream',
  boxShadow: '[0 3px 0 rgba(0, 0, 0, 0.3)]',
  '&.off': { bg: '[#7d8794]', borderColor: '[#b9c0c9]', filter: '[grayscale(1)]', opacity: '[0.8]' },
});

/** The sound and music switches, in the top right corner. */
const sys = css({ position: 'fixed', top: '[14px]', right: '[14px]', display: 'flex', gap: 'm', zIndex: '[1]' });

/** The version, in the bottom left corner. */
const version = css({
  position: 'fixed',
  left: '[14px]',
  bottom: '[10px]',
  fontSize: '12',
  fontWeight: 'bold',
  color: 'cream',
  opacity: '[0.75]',
  textShadow: '[0 1px 2px rgba(0, 0, 0, 0.5)]',
  pointerEvents: 'none',
});

/** The game is unfinished, and says so beside its version. */
const alpha = css({
  display: 'inline-block',
  mr: 'xs',
  p: '[1px 7px]',
  borderRadius: '[7px]',
  bg: 'gold',
  color: 'navy',
  fontWeight: '[700]',
  letterSpacing: '[0.04em]',
  textTransform: 'uppercase',
  textShadow: '[none]',
});

/** The changelog, from the corner across from the version, with a downloaded update offered above it. */
const corner = css({
  position: 'fixed',
  right: '[14px]',
  bottom: 'l',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 'm',
});

/** A button in the corner, such as What's new. */
const news = css.raw({
  border: '[2.5px solid {colors.white}]',
  borderRadius: '[14px]',
  bg: '[rgba(44, 58, 78, 0.84)]',
  color: 'white',
  fontSize: '15',
  fontWeight: 'bold',
  p: '[6px 13px]',
  boxShadow: '[0 3px 0 rgba(0, 0, 0, 0.3)]',
  _hover: { bg: '[#19bcd6]' },
  '&[hidden]': { display: 'none' },
  // icons on the dark panel sit on cream chips, or their navy outlines would vanish
  '& .icon': { bg: 'cream', borderRadius: '[6px]', p: '[1.5px]' },
});
const newsButton = css(news);

/** The button for an update that has downloaded, edged in gold. */
const updateButton = css(news, { borderColor: 'gold' });

/** How the look for an update is going, where its button shows once one has downloaded: quieter, with nothing to press. */
const updateLook = css({
  border: '[2px solid rgba(255, 255, 255, 0.6)]',
  borderRadius: '[14px]',
  bg: '[rgba(44, 58, 78, 0.7)]',
  color: 'white',
  fontSize: '13',
  fontWeight: 'bold',
  p: '[4px 11px]',
  boxShadow: '[0 2px 0 rgba(0, 0, 0, 0.25)]',
  animation: 'pop 0.25s ease-out',
  '& .icon': { bg: 'cream', borderRadius: '[50%]', p: '[1px]' },
  // the arrows go round while it checks or downloads, inside a chip that stays still
  '&.busy .icon use': {
    transformBox: 'view-box',
    transformOrigin: 'center',
    animation: 'update-spin 1.4s linear infinite',
    _motionReduce: { animation: 'none' },
  },
  _motionReduce: { animation: 'none' },
});

type Panel = 'campaign' | 'sandbox' | 'saves' | 'settings' | 'changes' | 'feedback';

/** The heading over each panel. */
const PANEL_NAMES: Readonly<Record<Panel, string>> = {
  campaign: 'Campaign',
  sandbox: 'Sandbox',
  saves: 'Load game',
  settings: 'Settings',
  changes: 'What’s new',
  feedback: 'Give feedback',
};

/** The logo, the latest save and the ways into the game. */
export function TitleScreen({ audio, exit, update, fullScreen, note = '', welcome = false, onPick }: TitleScreenProps) {
  const redraw = useRedraw();
  /** The panel showing under the logo in place of the menu, if any. */
  const [showing, setShowing] = useState<Panel | null>(null);
  /** Panels that have been opened stay in place while hidden, so they keep what was typed into them. */
  const [opened, setOpened] = useState<readonly Panel[]>([]);
  /** Whether the player is being asked to restart for the downloaded update. */
  const [askingToUpdate, setAskingToUpdate] = useState(false);
  /** Whether the welcome to the alpha is up. */
  const [welcoming, setWelcoming] = useState(welcome);
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
  // title-panel and title-sub are what the scroll cues look for (ui/scroll-cue.ts), and title-sys, title-logo, save-card,
  // save-thumb and title-version are for the tests
  return (
    <>
      <div class={backdropLook} style={{ backgroundImage: `url(${picture ?? backdrop})` }} />
      <div class={cx('title-sys', sys)}>
        <button
          class={cx(roundButton({ size: 'small' }), !audio.sound && 'off')}
          title="Sound effects"
          aria-pressed={audio.sound ? 'true' : 'false'}
          onClick={flip(() => {
            audio.toggleSound();
          })}
        >
          <Icon id={audio.sound ? 'ui-sound' : 'ui-mute'} size={22} />
        </button>{' '}
        <button
          class={cx(roundButton({ size: 'small' }), !audio.music && 'off')}
          title="Music"
          aria-pressed={audio.music ? 'true' : 'false'}
          onClick={flip(() => {
            audio.toggleMusic();
          })}
        >
          <Icon id="ui-music" size={22} />
        </button>
      </div>
      <div class={stack}>
        <h1 class={cx('title-logo', logoLook)}>
          <img class={logoPicture} src={logo} alt={GAME_TITLE} />
        </h1>
        <div class={cx('title-panel', panelLook, showing && 'has-sub')}>
          {note && (
            <p class={noteLook} role="alert">
              {note}
            </p>
          )}
          {showing && (
            <div class={subHead}>
              <button
                class={back}
                onClick={() => {
                  setShowing(null);
                }}
              >
                ‹ Back
              </button>
              <h2 class={subName}>{PANEL_NAMES[showing]}</h2>
            </div>
          )}
          {!showing && latest && (
            <div class="save-card">
              <h2 class={saveName}>{latest.name}</h2>
              {latest.center && latest.center !== 'sandbox' && <p class={centerName}>{CENTERS[latest.center].name}</p>}
              <div class={saveBody}>
                {picture ? (
                  <img class={cx('save-thumb', thumbPicture)} src={picture} alt="" />
                ) : (
                  <div class={cx('save-thumb', noPicture)}>
                    <Icon id="ui-treatments" size={48} />
                  </div>
                )}
                <ul class={facts}>
                  {saveFacts(latest).map((f) => (
                    <li key={f.icon} class={fact}>
                      <Icon id={f.icon} size={20} />
                      {f.text}
                    </li>
                  ))}
                  <li class={savedAt}>{`Saved ${timeAgo(latest.savedAt)}`}</li>
                </ul>
              </div>
            </div>
          )}
          <div class={menu} hidden={!!showing}>
            {latest && (
              <>
                <button
                  class={menuButton}
                  onClick={() => {
                    onPick(latest.id);
                  }}
                >
                  Continue
                </button>
                <button
                  class={menuButton}
                  onClick={() => {
                    open('saves');
                  }}
                >
                  Load game
                </button>
              </>
            )}
            <button
              class={menuButton}
              onClick={() => {
                open('campaign');
              }}
            >
              Campaign
            </button>
            <button
              class={menuButton}
              title="A center of your own, with no deadline"
              onClick={() => {
                open('sandbox');
              }}
            >
              Sandbox
            </button>
            <button
              class={menuButton}
              onClick={() => {
                open('settings');
              }}
            >
              Settings
            </button>
            {exit && (
              <button class={menuButton} onClick={exit}>
                Exit
              </button>
            )}
          </div>
          <div id="title-campaign" class={cx('title-sub', sub)} hidden={showing !== 'campaign'}>
            {opened.includes('campaign') && <CampaignPanel onStart={onPick} audio={audio} />}
            <ScrollTab />
          </div>
          <div id="title-sandbox" class={cx('title-sub', sub)} hidden={showing !== 'sandbox'}>
            {opened.includes('sandbox') && (
              <SandboxPanel
                audio={audio}
                onStart={() => {
                  onPick('new');
                }}
              />
            )}
            <ScrollTab />
          </div>
          <div id="title-saves" class={cx('title-sub', sub)} hidden={showing !== 'saves'}>
            {opened.includes('saves') && <SavesPanel onLoad={onPick} />}
            <ScrollTab />
          </div>
          <div id="title-settings" class={cx('title-sub', sub)} hidden={showing !== 'settings'}>
            {opened.includes('settings') && <SettingsPanel audio={audio} fullScreen={fullScreen} onChange={redraw} />}
            <ScrollTab />
          </div>
          <div id="title-changes" class={cx('title-sub', sub)} hidden={showing !== 'changes'}>
            {opened.includes('changes') && <ChangelogPanel />}
            <ScrollTab />
          </div>
          <div id="title-feedback" class={cx('title-sub', sub)} hidden={showing !== 'feedback'}>
            {opened.includes('feedback') && <FeedbackPanel from={{ screen: 'title' }} />}
            <ScrollTab />
          </div>
        </div>
        <p class={cx('title-version', version)}>
          <span class={alpha}>Alpha</span> {`v${__APP_VERSION__}`}
        </p>
        <div class={corner}>
          {update && updateVersion && (
            <button
              class={updateButton}
              title={`Version ${updateVersion} has downloaded`}
              onClick={() => {
                setAskingToUpdate(true);
              }}
            >
              <IconText id="ui-update">Update to the latest version</IconText>
            </button>
          )}
          {updateLine && (
            <p class={cx(updateLook, updateStatus.state !== 'latest' && 'busy')} role="status">
              <IconText id={updateLine.icon}>{updateLine.text}</IconText>
            </p>
          )}
          <button
            class={newsButton}
            hidden={showing === 'feedback'}
            onClick={() => {
              open('feedback');
            }}
          >
            Give feedback
          </button>
          <button
            class={newsButton}
            hidden={showing === 'changes'}
            onClick={() => {
              open('changes');
            }}
          >
            <IconText id="ui-news">What’s new</IconText>
          </button>
        </div>
        <div class={tray} hidden={!!showing}>
          {badges.map((b) => (
            <span key={b.label} class={cx(badge, !b.on && 'off')} title={b.label} aria-label={b.label}>
              <Icon id={b.icon} size="62%" />
            </span>
          ))}
        </div>
      </div>
      {welcoming && (
        <Dialog>
          <h2>Welcome to the alpha</h2>
          <p>
            {`${GAME_TITLE} is in alpha: it is still being built, and it changes every day. Expect some rough edges and bugs.`}
          </p>{' '}
          <p class="sub">
            Your feedback decides what comes next. Use Give feedback here, or in the pause menu during a game.
          </p>{' '}
          <div class={buttonRow()}>
            <button
              class={goButton()}
              onClick={() => {
                saveWelcomeSeen();
                setWelcoming(false);
              }}
            >
              Let’s play
            </button>
          </div>
        </Dialog>
      )}
      {askingToUpdate && update && updateVersion && (
        <Dialog>
          <h2>Restart to update?</h2>
          <p>{`The game will close, install version ${updateVersion} and open again. Your saved games are kept.`}</p>{' '}
          <p class="sub">Or not now: it installs by itself the next time you quit.</p>{' '}
          <div class={buttonRow()}>
            <button
              onClick={() => {
                setAskingToUpdate(false);
              }}
            >
              Not now
            </button>
            <button class={goButton()} onClick={update.install}>
              Restart and update
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
