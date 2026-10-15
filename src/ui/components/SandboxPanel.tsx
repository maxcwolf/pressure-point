// Setting up a sandbox game on the title screen: its money, its treatments, whether everything starts unlocked, and
// which events and pressures it has.

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
      <h4>Events</h4>
      <ul>
        <SettingRow
          icon="🎯"
          name="Staff challenges"
          desc="Now and then a member of staff sets the center an objective with a deadline, for a reward."
          on={settings.challenges}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, challenges: !settings.challenges });
            });
          }}
        />
        <SettingRow
          icon="😰"
          name="Stress outbreaks"
          desc="From the second star, an outbreak of stress may be offered, to be calmed before it spreads."
          on={settings.outbreaks}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, outbreaks: !settings.outbreaks });
            });
          }}
        />
        <SettingRow
          icon="🌡️"
          name="Weather"
          desc="Cold winters and warm summers that radiators and air conditioners keep out. Off, it is always just right."
          on={settings.weather}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, weather: !settings.weather });
            });
          }}
        />
        <SettingRow
          icon="🕶️"
          name="VIPs and inspections"
          desc="VIPs who write ahead and judge a few rooms, and a health inspector who checks them all."
          on={settings.visits}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, visits: !settings.visits });
            });
          }}
        />
        <SettingRow
          icon="🏪"
          name="Rival center"
          desc="A franchise across the street that holds sales, hires away unhappy staff and competes for Center of the Year."
          on={settings.rival}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, rival: !settings.rival });
            });
          }}
        />
        <SettingRow
          icon="🚨"
          name="Mishaps"
          desc="Power cuts, storms, freezes and wasps, each warned of a few days ahead."
          on={settings.mishaps}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, mishaps: !settings.mishaps });
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
