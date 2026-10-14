// Setting up a sandbox game on the title screen: its money, its treatments, and whether everything starts unlocked.

import './SandboxPanel.css';

import type { Audio } from '../../audio';
import { DISCIPLINE_ORDER, DISCIPLINES, SANDBOX_MONEY } from '../../core/data';
import { money } from '../../core/format';
import { loadDisciplinePrefs, loadSandbox, saveDisciplinePref, saveSandbox } from '../../storage/settings';
import { useRedraw } from '../hooks/use-redraw';
import { cx } from '../lib/cx';
import { SettingRow } from './SettingsPanel';

export interface SandboxPanelProps {
  audio: Audio;
  /** Start the sandbox game, set up as chosen. */
  onStart: () => void;
}

/** The sandbox's settings, remembered for next time, and a button to start. */
export function SandboxPanel({ audio, onStart }: SandboxPanelProps) {
  const redraw = useRedraw();
  const settings = loadSandbox();
  /** Change a setting, click, and show it. */
  const change = (apply: () => void) => {
    audio.unlock();
    apply();
    audio.play('blip');
    redraw();
  };
  return (
    <div class="sandbox settings">
      <p class="sub">A big lot of your own, with no deadline. Set it up how you like.</p>
      <h4>Starting money</h4>
      <div class="tabs money" role="radiogroup" aria-label="Starting money">
        {SANDBOX_MONEY.map((m) => (
          <button
            key={m}
            role="radio"
            class={cx('tab', settings.money === m && 'on')}
            aria-checked={settings.money === m ? 'true' : 'false'}
            onClick={() => {
              change(() => {
                saveSandbox({ ...settings, money: m });
              });
            }}
          >
            {money(m)}
          </button>
        ))}
      </div>
      <h4>Treatments</h4>
      <ul>
        {DISCIPLINE_ORDER.filter((d) => DISCIPLINES[d].optional).map((d) => {
          const def = DISCIPLINES[d];
          const on = loadDisciplinePrefs()[d] !== false;
          return (
            <SettingRow
              key={d}
              icon={def.icon}
              name={def.name}
              desc={def.desc}
              on={on}
              onToggle={() => {
                change(() => {
                  saveDisciplinePref(d, !on);
                });
              }}
            />
          );
        })}
      </ul>
      <h4>Unlocks</h4>
      <ul>
        <SettingRow
          icon="🔓"
          name="Everything unlocked"
          desc="Every room, item and treatment from day one, instead of opening them up star by star."
          on={settings.unlockAll}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, unlockAll: !settings.unlockAll });
            });
          }}
        />
      </ul>
      <button class="go start" onClick={onStart}>
        Start building
      </button>
    </div>
  );
}
