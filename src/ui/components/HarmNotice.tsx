// Top center, with the offers: why the same harm keeps coming to guests, with what is behind it and the way to the
// fix, until it is read.

import { ROLES } from '../../core/data';
import { an } from '../../core/format';
import type { HarmNote } from '../../core/state/types';
import { useGame, useHud } from '../hooks/use-hud';
import type { HudState } from '../hud';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/** What the button to the fix says. */
function fixLabel(fix: NonNullable<HarmNote['fix']>): string {
  if ('hire' in fix) return `Hire ${an(ROLES[fix.hire].name)}`;
  return { rooms: 'Open Rooms', items: 'Open Items', prices: 'Open Prices' }[fix.menu];
}

/** Open the menu with the fix in it, at the right tab, leaving it open if it already is. */
function openFix(hud: HudState, fix: NonNullable<HarmNote['fix']>) {
  if ('hire' in fix) hud.hireRole = fix.hire;
  if (!('hire' in fix) && fix.menu === 'prices') hud.moneyTab = 'prices';
  const menu = 'hire' in fix ? 'hire' : fix.menu === 'prices' ? 'finance' : fix.menu;
  if (hud.menu !== menu) hud.toggleMenu(menu);
}

/** What the button to show who or what it is about says. */
const showLabel: Record<NonNullable<HarmNote['about']>['kind'], string> = {
  guest: 'Show the guest',
  staff: 'Show them',
  item: 'Show me',
  room: 'Show the room',
};

/** The first explanation waiting to be read, if any. */
export function HarmNotice() {
  const hud = useHud();
  const { sim } = useGame();
  const note = sim.s.harmNotes[0];
  if (!note) return null;
  const { about, fix } = note;
  return (
    <div class="panel offer harm">
      <h3>
        <IconText id="ui-warning">{note.title}</IconText>
      </h3>
      <p class="sub">
        {note.cost}
        {sim.s.harmNotes.length > 1 && ` · ${sim.s.harmNotes.length - 1} more after this`}
      </p>
      <ul class="causes">
        {note.causes.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            {c.amount && <b>{c.amount}</b>}
          </li>
        ))}
      </ul>
      <p class="help">{note.help}</p>
      <div class="btnrow">
        {about && (
          <Button
            class={fix ? '' : 'go'}
            onPress={() => {
              hud.show(about);
            }}
          >
            {showLabel[about.kind]}
          </Button>
        )}
        {fix && (
          <Button
            class="go"
            onPress={() => {
              openFix(hud, fix);
            }}
          >
            {fixLabel(fix)}
          </Button>
        )}
        <Button
          onPress={() => {
            sim.dismissHarm();
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
