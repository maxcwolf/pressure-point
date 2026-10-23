// The settings switches, shared by the title screen and the pause menu.

import './SettingsPanel.css';

import { useEffect } from 'preact/hooks';

import { setSharing, sharing, track } from '../../app/analytics';
import type { Audio } from '../../audio/audio';
import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES, QIGONG_SETTING } from '../../core/data';
import type { Sim } from '../../core/sim/sim';
import { disciplineHere } from '../../core/state/game';
import { loadControls, saveControls } from '../../storage/controls';
import { ITEM_VIEWS, loadDisplay, MESSAGE_TIMES, saveDisplay } from '../../storage/display';
import { loadDisciplinePrefs, saveDisciplinePref } from '../../storage/settings';
import { useRedraw } from '../hooks/use-redraw';
import type { FullScreenSwitch } from '../host';
import { ITEM_VIEW_NAMES } from '../lib/item-stats';
import { nextChoice } from '../lib/keys';
import { MESSAGE_TIME_NAMES } from '../lib/messages';
import { Icon } from './common/Icon';
import { ControlSettings } from './ControlSettings';
import { SettingRow } from './SettingRow';

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
 * Switches for which treatments are offered, how items show their stats, the controls, how long messages stay, full
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
  return (
    <div class="settings">
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
            class="choice item-view-choice"
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
          <Icon id="ui-news" size={26} />
          <div>
            <b>Messages stay</b>
            <span>
              How long the messages on the right stay: long enough to read, twice that, or until you dismiss them. A
              message waits while the pointer is on it, though the game plays on, and while the game is paused.
            </span>
          </div>{' '}
          <button
            class="choice message-time-choice"
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
