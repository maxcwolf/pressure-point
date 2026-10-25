// Setting up a sandbox game on the title screen: its money, how hard it is, its treatments, whether everything starts
// unlocked, and which events and pressures it has.

import type { Audio } from '../../audio/audio';
import { DISCIPLINE_ORDER, DISCIPLINES, QIGONG_SETTING, SANDBOX_MONEY } from '../../core/data';
import { money } from '../../core/format';
import { loadDisciplinePrefs, loadSandbox, saveDisciplinePref, saveSandbox } from '../../storage/settings';
import { css } from '../../styled-system/css';
import { goButton, tabButton, tabStrip } from '../../styled-system/recipes';
import { useRedraw } from '../hooks/use-redraw';
import { cx } from '../lib/cx';
import { DifficultySettings } from './DifficultySettings';
import { SettingRow } from './SettingRow';
import { settingsLook } from './SettingsPanel';

/** The sandbox's settings, laid out as the settings panel's, with the words under the headings in the middle. */
const sandboxLook = css({ '& > .sub': { textAlign: 'center' } });

/** The amounts of money to start with, a little apart. */
const amounts = css({ gap: 's' });

/** Start building, big, in the middle under the settings. */
const start = css({ display: 'block', m: '[14px auto 2px]', fontSize: '17', p: '[8px 22px]' });

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
    <div class={cx(settingsLook, sandboxLook)}>
      <p class="sub">A big lot of your own, with no deadline. Set it up how you like.</p>
      <h4>Starting money</h4>
      <div class={cx(tabStrip(), amounts)} role="radiogroup" aria-label="Starting money">
        {SANDBOX_MONEY.map((m) => (
          <button
            key={m}
            role="radio"
            class={cx(tabButton(), settings.money === m && 'on')}
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
      <DifficultySettings
        difficulty={settings.difficulty}
        onChange={(difficulty) => {
          change(() => {
            saveSandbox({ ...settings, difficulty });
          });
        }}
      />
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
        <SettingRow
          icon={QIGONG_SETTING.icon}
          name={QIGONG_SETTING.name}
          desc={QIGONG_SETTING.desc}
          on={loadDisciplinePrefs().qigong !== false}
          onToggle={() => {
            change(() => {
              saveDisciplinePref('qigong', loadDisciplinePrefs().qigong === false);
            });
          }}
        />
      </ul>
      <h4>Unlocks</h4>
      <ul>
        <SettingRow
          icon="ui-unlock"
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
          icon="ui-target"
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
          icon="bubble-stressed"
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
          icon="overlay-temperature"
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
          icon="ui-vip"
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
          icon="ui-rival"
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
          icon="ui-emergency"
          name="Mishaps"
          desc="Power cuts, storms, freezes and wasps, each warned of a few days ahead."
          on={settings.mishaps}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, mishaps: !settings.mishaps });
            });
          }}
        />
        <SettingRow
          icon="ui-fire-truck"
          name="Fires"
          desc="A machine smoking with wear can catch fire when it overloads, and the fire brigade comes."
          on={settings.fires}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, fires: !settings.fires });
            });
          }}
        />
        <SettingRow
          icon="ui-loan"
          name="Bankruptcy"
          desc="A payday the bank cannot cover asks you to borrow the wages, or pays them into the red. In the red past what it will lend, with the books losing money, the bank gives you ten days to put one of the two right. Fail, and the game is lost. Off, the bank just goes into the red."
          on={settings.bankruptcy}
          onToggle={() => {
            change(() => {
              saveSandbox({ ...settings, bankruptcy: !settings.bankruptcy });
            });
          }}
        />
      </ul>
      <button class={cx(goButton(), start)} onClick={onStart}>
        Start building
      </button>
    </div>
  );
}
