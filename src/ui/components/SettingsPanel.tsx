// The settings switches, shared by the title screen and the pause menu.

import './SettingsPanel.css';

import type { Audio } from '../../audio';
import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES, QIGONG_SETTING } from '../../core/data';
import type { Sim } from '../../core/sim/sim';
import { disciplineHere } from '../../core/state/game';
import { loadDisciplinePrefs, saveDisciplinePref } from '../../storage/settings';
import { useRedraw } from '../hooks/use-redraw';
import { ControlSettings } from './ControlSettings';
import { SettingRow } from './SettingRow';

export interface SettingsPanelProps {
  audio: Audio;
  /** The game in progress, if any. Without one, choices apply to the next new game. */
  sim?: Sim | undefined;
  /** Called after any switch is flipped. */
  onChange?: (() => void) | undefined;
}

/** Switches for which treatments are offered, the controls, and sound and music. */
export function SettingsPanel({ audio, sim, onChange }: SettingsPanelProps) {
  const redraw = useRedraw();
  /** Whether a discipline is switched on, in this game or for new ones. */
  const isOn = (d: Discipline) => (sim ? sim.enabled(d) : loadDisciplinePrefs()[d] !== false);
  /** Flip a switch, click, and let everyone know. */
  const flip = (change: () => void) => () => {
    audio.unlock();
    change();
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
              onToggle={flip(() => {
                const on = !isOn(d);
                // remembered for future games, and applied to this one if there is one
                saveDisciplinePref(d, on);
                sim?.setDiscipline(d, on);
              })}
            />
          );
        })}
        <SettingRow
          icon={QIGONG_SETTING.icon}
          name={QIGONG_SETTING.name}
          desc={QIGONG_SETTING.desc}
          on={sim ? sim.enabled('qigong') : loadDisciplinePrefs().qigong !== false}
          onToggle={flip(() => {
            const on = !(sim ? sim.enabled('qigong') : loadDisciplinePrefs().qigong !== false);
            saveDisciplinePref('qigong', on);
            sim?.setDiscipline('qigong', on);
          })}
        />
      </ul>
      <p class="sub">
        {sim
          ? 'Switching a treatment off hides its room, staff and equipment and stops its guests arriving. Anything already built stays where it is.'
          : 'These choices apply to new games. A game in progress keeps its own, which you can change from its pause menu.'}
      </p>
      <ControlSettings
        onChange={() => {
          audio.unlock();
          audio.play('blip');
          onChange?.();
        }}
      />
      <h4>Audio</h4>
      <ul>
        <SettingRow
          icon="🔊"
          name="Sound effects"
          desc="Clicks, chimes and the cash register."
          on={audio.sound}
          onToggle={flip(() => {
            audio.toggleSound();
          })}
        />
        <SettingRow
          icon="🎵"
          name="Music"
          desc="The lounge loop in the background."
          on={audio.music}
          onToggle={flip(() => {
            audio.toggleMusic();
          })}
        />
      </ul>
    </div>
  );
}
