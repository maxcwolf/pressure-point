// Top center, with the offers: why the same harm keeps coming to guests, with what is behind it and the way to the
// fix, until it is read.

import { ROLES } from '../../core/data';
import { an } from '../../core/format';
import type { HarmNote } from '../../core/state/types';
import { css } from '../../styled-system/css';
import { buttonRow, goButton, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import type { HudState } from '../hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/** The explanation: a panel in red, popping in, its words to the left. */
const card = css({ position: 'relative', borderColor: 'red', textAlign: 'left', animation: 'pop 0.2s ease-out' });

/** Its heading, smaller than a panel's. */
const heading = css({ fontSize: '15' });

/** What the harm is costing, and how many more explanations wait after this one, close under the heading. */
const cost = css({ fontSize: '14', lineHeight: '[1.3]', mt: '0' });

/** What is behind it, a line each with how much it adds, on a faint ground; the first, the biggest, in bold. */
const causes = css({
  listStyle: 'none',
  py: '6',
  px: '8',
  my: '8',
  mx: '0',
  bg: 'ink.6',
  borderRadius: '8',
  fontSize: '13',
  '& li': { display: 'flex', justifyContent: 'space-between', gap: '10', py: '[1px]', px: '0' },
  '& li:first-child': { fontWeight: 'bold' },
  '& b': { color: 'bad', whiteSpace: 'nowrap' },
});

/** The way to the fix, in words. */
const help = css({ fontSize: '14', lineHeight: '[1.3]' });

/** Its buttons, at the left. */
const buttons = css({ justifyContent: 'flex-start' });

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
    <div class={cx(panelCard(), card)}>
      <h3 class={heading}>
        <IconText id="ui-warning">{note.title}</IconText>
      </h3>
      <p class={cx('sub', cost)}>
        {note.cost}
        {sim.s.harmNotes.length > 1 && ` · ${sim.s.harmNotes.length - 1} more after this`}
      </p>
      <ul class={causes}>
        {note.causes.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            {c.amount && <b>{c.amount}</b>}
          </li>
        ))}
      </ul>
      <p class={help}>{note.help}</p>
      <div class={cx(buttonRow(), buttons)}>
        {about && (
          <Button
            class={fix ? '' : goButton()}
            onPress={() => {
              hud.show(about);
            }}
          >
            {showLabel[about.kind]}
          </Button>
        )}
        {fix && (
          <Button
            class={goButton()}
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
