// The settings switches, shared by the title screen and the pause menu.

import { useEffect } from 'preact/hooks';

import { setSharing, sharing, track } from '../../app/analytics';
import type { Audio } from '../../audio/audio';
import { CAMPAIGN, type Discipline, DISCIPLINE_ORDER, DISCIPLINES, QIGONG_SETTING } from '../../core/data';
import type { Sim } from '../../core/sim/sim';
import { disciplineHere, offeringHere } from '../../core/state/game';
import { loadControls, saveControls } from '../../storage/controls';
import { ITEM_VIEWS, loadDisplay, MESSAGE_TIMES, saveDisplay, UI_SCALES } from '../../storage/display';
import { loadDisciplinePrefs, loadLessonsPref, saveDisciplinePref, saveTutorialPref } from '../../storage/settings';
import { css } from '../../styled-system/css';
import { applyDisplay } from '../display';
import { useRedraw } from '../hooks/use-redraw';
import type { FullScreenSwitch } from '../host';
import { ITEM_VIEW_NAMES } from '../lib/item-stats';
import { nextChoice } from '../lib/keys';
import { MESSAGE_TIME_NAMES } from '../lib/messages';
import { Icon } from './common/Icon';
import { ControlSettings } from './ControlSettings';
import { choice, SettingRow } from './SettingRow';

export interface SettingsPanelProps {
  audio: Audio;
  /** The game in progress, if any. Without one, choices apply to the next new game. */
  sim?: Sim | undefined;
  /** Whether the desktop app's window fills the screen. Undefined in a browser, where the switch is left out. */
  fullScreen?: FullScreenSwitch | undefined;
  /** Called after any switch is flipped. */
  onChange?: (() => void) | undefined;
}

/**
 * The settings, in lists under headings: each row an icon, a name over a word on what it does, and a switch, a choice
 * or why it cannot be changed; the keys in two columns. The rows are drawn by SettingRow.tsx, ControlSettings.tsx and
 * the panel itself, and the sandbox's settings (SandboxPanel.tsx) are laid out the same.
 */
export const settingsLook = css({
  textAlign: 'left',
  m: '[8px 0 4px]',
  '& h4': { fontSize: '[15px]', fontWeight: 'bold', m: '[12px 0 5px]' },
  '& ul': { listStyle: 'none', p: 'none', display: 'flex', flexDirection: 'column', gap: 's' },
  '& li': {
    display: 'flex',
    alignItems: 'center',
    gap: '[10px]',
    bg: 'white',
    border: 'card',
    borderRadius: 'card',
    p: '[7px 11px]',
  },
  '& li > .icon': { flex: 'none' },
  '& li > div': { flex: '1', minW: '[0]' },
  '& li b': { display: 'block', fontWeight: 'bold', fontSize: '[15px]' },
  '& li span': { fontSize: 'small', opacity: '[0.75]' },
  '& li em': {
    fontStyle: 'normal',
    fontSize: '[12px]',
    bg: 'sand',
    borderRadius: '[8px]',
    p: '[2px 8px]',
    whiteSpace: 'nowrap',
  },
  '& li.locked > div': { opacity: '[0.6]' },
  '& .key-list': { display: 'grid', gridTemplateColumns: '[1fr 1fr]', gap: 's' },
  '& .key-list li': { justifyContent: 'space-between', p: '[5px 9px 5px 12px]', fontSize: '[14px]' },
});

/**
 * Switches for the tutorial, which treatments are offered, how items show their stats, the controls, how long messages stay, full
 * screen in the desktop app, sound and music, the cheat console and sharing play statistics.
 */
export function SettingsPanel({ audio, sim, fullScreen, onChange }: SettingsPanelProps) {
  const redraw = useRedraw();
  // the window can leave full screen by its own button or keys while the settings are open
  useEffect(() => fullScreen?.subscribe(redraw), [fullScreen, redraw]);
  /** Whether a discipline is switched on, in this game or for new ones. */
  const isOn = (d: Discipline) => (sim ? sim.enabled(d) : loadDisciplinePrefs()[d] !== false);
  /** Flip a switch, click, count it in the play statistics, and let everyone know. */
  const flip = (setting: string, change: () => boolean | string) => () => {
    audio.unlock();
    const value = change();
    track('setting_changed', { setting, value });
    audio.play('blip');
    redraw();
    onChange?.();
  };
  // the tutorial is the campaign's, so in a game in one of its centers it is that game's switch; anywhere else, the
  // next one's
  const campaignGame = sim && CAMPAIGN.includes(sim.s.center) ? sim : undefined;
  /** Whether the tutorial is on, in the campaign game in progress or for the next ones. */
  const tutorialOn = () => (campaignGame ? campaignGame.tutorialOn() : loadLessonsPref());
  return (
    <div class={settingsLook}>
      <h4>Help</h4>
      <ul>
        <SettingRow
          icon="ui-advisor"
          name="Tutorial"
          desc="Walk a new Willow Lane game through its opening, pointing at what each step wants, and explain each thing the first time it happens in the campaign, such as the first cold snap. On by itself before your first campaign star. The walk-through switches itself off once you have been through it; the cards keep coming, once each, until you turn this off."
          on={tutorialOn()}
          onToggle={flip('tutorial', () => {
            const on = !tutorialOn();
            saveTutorialPref(on);
            campaignGame?.setTutorial(on);
            return on;
          })}
        />
      </ul>
      <h4>Treatments</h4>
      <ul>
        {/* in a game, only the treatments its center offers; for new games, all of them */}
        {DISCIPLINE_ORDER.filter((d) => !sim || disciplineHere(sim.s, d)).map((d) => {
          const def = DISCIPLINES[d];
          return (
            <SettingRow
              key={d}
              icon={def.icon}
              name={def.name}
              desc={def.desc}
              on={isOn(d)}
              locked={def.optional ? '' : 'Always on'}
              onToggle={flip(d, () => {
                const on = !isOn(d);
                // remembered for future games, and applied to this one if there is one
                saveDisciplinePref(d, on);
                sim?.setDiscipline(d, on);
                return on;
              })}
            />
          );
        })}
        {(!sim || offeringHere(sim.s, 'qigong')) && (
          <SettingRow
            icon={QIGONG_SETTING.icon}
            name={QIGONG_SETTING.name}
            desc={QIGONG_SETTING.desc}
            on={sim ? sim.enabled('qigong') : loadDisciplinePrefs().qigong !== false}
            onToggle={flip('qigong', () => {
              const on = !(sim ? sim.enabled('qigong') : loadDisciplinePrefs().qigong !== false);
              saveDisciplinePref('qigong', on);
              sim?.setDiscipline('qigong', on);
              return on;
            })}
          />
        )}
      </ul>
      <p class="sub">
        {sim
          ? 'Switching a treatment off hides its room, staff and equipment and stops its guests arriving. Anything already built stays where it is.'
          : 'These choices apply to new games. A game in progress keeps its own, which you can change from its pause menu.'}
      </p>
      <h4>Building</h4>
      <ul>
        <li>
          <Icon id="ui-prices" size={26} />
          <div>
            <b>Item stats</b>
            <span>Where the Items menu shows what each item does: its decor, noise, warmth and upkeep.</span>
          </div>{' '}
          <button
            class={choice}
            onClick={flip('itemView', () => {
              const prefs = loadDisplay();
              const itemView = nextChoice(ITEM_VIEWS, prefs.itemView);
              saveDisplay({ ...prefs, itemView });
              return itemView;
            })}
          >
            {ITEM_VIEW_NAMES[loadDisplay().itemView]}
          </button>
        </li>
        <SettingRow
          icon="ui-zoom"
          name="Preview while placing"
          desc="An item in hand shows what it would change where it is about to go, and colors the floor to match."
          on={loadDisplay().placePreview}
          onToggle={flip('placePreview', () => {
            const prefs = loadDisplay();
            saveDisplay({ ...prefs, placePreview: !prefs.placePreview });
            return !prefs.placePreview;
          })}
        />
      </ul>
      <ControlSettings
        onChange={() => {
          audio.unlock();
          audio.play('blip');
          onChange?.();
        }}
      />
      <h4>Display</h4>
      <ul>
        <li>
          <Icon id="ui-size" size={26} />
          <div>
            <b>Interface size</b>
            <span>
              How big the panels, buttons and words in a game are drawn: larger for a big screen, or one seen from afar.
            </span>
          </div>{' '}
          <button
            class={choice}
            aria-label="Interface size"
            onClick={flip('uiScale', () => {
              const prefs = loadDisplay();
              const uiScale = nextChoice(UI_SCALES, prefs.uiScale);
              saveDisplay({ ...prefs, uiScale });
              applyDisplay();
              return String(uiScale);
            })}
          >
            {`${Math.round(loadDisplay().uiScale * 100)}%`}
          </button>
        </li>
        <li>
          <Icon id="ui-news" size={26} />
          <div>
            <b>Messages stay</b>
            <span>
              How long the messages on the right stay: long enough to read, twice that, or until you dismiss them. A
              message waits while the pointer is on it, though the game plays on, and while the game is paused.
            </span>
          </div>{' '}
          <button
            class={choice}
            onClick={flip('messages', () => {
              const prefs = loadDisplay();
              const messages = nextChoice(MESSAGE_TIMES, prefs.messages);
              saveDisplay({ ...prefs, messages });
              return messages;
            })}
          >
            {MESSAGE_TIME_NAMES[loadDisplay().messages]}
          </button>
        </li>
        {fullScreen && (
          <SettingRow
            icon="ui-display"
            name="Full screen"
            desc="Fill the screen with the game. It opens the same way next time."
            on={fullScreen.on()}
            onToggle={flip('fullScreen', () => {
              const on = !fullScreen.on();
              fullScreen.set(on);
              return on;
            })}
          />
        )}
      </ul>
      <h4>Audio</h4>
      <ul>
        <SettingRow
          icon="ui-sound"
          name="Sound effects"
          desc="Clicks, chimes and the cash register."
          on={audio.sound}
          onToggle={flip('sound', () => {
            audio.toggleSound();
            return audio.sound;
          })}
        />
        <SettingRow
          icon="ui-music"
          name="Music"
          desc="The lounge loop in the background."
          on={audio.music}
          onToggle={flip('music', () => {
            audio.toggleMusic();
            return audio.music;
          })}
        />
      </ul>
      <h4>Cheats</h4>
      <ul>
        <SettingRow
          icon="ui-wand"
          name="Cheat console"
          desc="Press ~ in a game to type in commands, such as money or win. A campaign game they are used in earns no more achievements or stars."
          on={loadControls().console}
          onToggle={flip('console', () => {
            const prefs = loadControls();
            saveControls({ ...prefs, console: !prefs.console });
            return !prefs.console;
          })}
        />
      </ul>
      <h4>Privacy</h4>
      <ul>
        <SettingRow
          icon="ui-stats"
          name="Share play statistics"
          desc="Send anonymous figures on how games go, such as the rooms built and how each month ends, to help improve the game. Never your saves or their names."
          on={sharing()}
          onToggle={flip('sharing', () => {
            const on = !sharing();
            setSharing(on);
            return on;
          })}
        />
      </ul>
    </div>
  );
}
