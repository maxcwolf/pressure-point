// The Settings panel, shared by the title screen and the pause menu.
import type { Audio } from '../audio';
import { COMING_SOON, DISCIPLINES, DISCIPLINE_ORDER, type Discipline } from '../data';
import { loadDisciplinePrefs, saveDisciplinePref } from '../settings';
import type { Sim } from '../sim';

export interface SettingsPanelOptions {
  audio: Audio;
  /** The game in progress, if any. Without one, choices apply to the next new game. */
  sim?: Sim;
  onChange?(): void;
}

export function mountSettings(el: HTMLElement, opts: SettingsPanelOptions) {
  const { audio, sim } = opts;
  const isOn = (d: Discipline) => (sim ? sim.enabled(d) : loadDisciplinePrefs()[d] !== false);

  const row = (key: string, icon: string, name: string, desc: string, on: boolean, locked = '') =>
    `<li class="${locked ? 'locked' : ''}"><i>${icon}</i><div><b>${name}</b><span>${desc}</span></div>
       ${locked ? `<em>${locked}</em>` : `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${name}" data-setting="${key}"><span></span></button>`}</li>`;

  const render = () => {
    const disciplines = DISCIPLINE_ORDER.map((d) => {
      const def = DISCIPLINES[d];
      return row(`discipline:${d}`, def.icon, def.name, def.desc, isOn(d), def.optional ? '' : 'Always on');
    }).join('');
    const soon = COMING_SOON.map((c) => row('', c.icon, c.name, 'Not in the game yet.', false, 'Coming later')).join(
      '',
    );
    el.innerHTML = `<div class="settings">
      <h4>Treatments</h4>
      <ul>${disciplines}${soon}</ul>
      <p class="sub">${
        sim
          ? 'Switching a treatment off hides its room, staff and equipment and stops its guests arriving. Anything already built stays where it is.'
          : 'These choices apply to new games. A game in progress keeps its own, which you can change from its pause menu.'
      }</p>
      <h4>Audio</h4>
      <ul>${row('sound', '🔊', 'Sound effects', 'Clicks, chimes and the cash register.', audio.sound)}
          ${row('music', '🎵', 'Music', 'The lounge loop in the background.', audio.music)}</ul>
    </div>`;
  };

  el.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-setting]')?.dataset.setting;
    if (!key) return;
    audio.unlock();
    if (key === 'sound') audio.toggleSound();
    else if (key === 'music') audio.toggleMusic();
    else {
      const d = key.split(':')[1] as Discipline;
      const on = !isOn(d);
      // remembered for future games, and applied to this one if there is one
      saveDisciplinePref(d, on);
      sim?.setDiscipline(d, on);
    }
    audio.play('blip');
    render();
    opts.onChange?.();
  });
  render();
}
