// The build menu that is open, above the buttons that open it.

import type { ComponentChildren } from 'preact';

import { css } from '../../../styled-system/css';
import { Still, useExit } from '../../hooks/use-exit';
import { useHud } from '../../hooks/use-hud';
import { usePop } from '../../hooks/use-pop';
import type { MenuId } from '../../hud';
import { cx } from '../../lib/cx';
import { HireMenu } from './HireMenu';
import { ItemsMenu } from './ItemsMenu';
import { MoneyMenu } from './MoneyMenu';
import { PolicyMenu } from './PolicyMenu';
import { RoomsMenu } from './RoomsMenu';
import { StaffMenu } from './StaffMenu';
import { StatsMenu } from './StatsMenu';
import { TreatmentsMenu } from './TreatmentsMenu';

/**
 * Where the open menu sits: along the left, just above the bar, and wider while the Items menu has an item's panel
 * beside its cards. Its panel pops in as it opens, and shrinks away as it shuts, taking no more presses.
 */
const menuStyle = css({
  left: 'gutter',
  bottom: '[calc(var(--bar-h) + {spacing.4})]',
  w: '[min(780px, calc(var(--vw) - 28px))]',
  '&:has(.items-detail)': { w: '[min(1040px, calc(var(--vw) - 28px))]' },
  '&.leaving > .panel': { pointerEvents: 'none', animation: '[unpop {durations.fast} {easings.in} forwards]' },
  '&.pop > .panel': { animation: '[pop {durations.fast} {easings.out}]' },
});

/** The contents of a menu. */
function contents(menu: MenuId): ComponentChildren {
  switch (menu) {
    case 'rooms':
      return <RoomsMenu />;
    case 'items':
      return <ItemsMenu />;
    case 'hire':
      return <HireMenu />;
    case 'staff':
      return <StaffMenu />;
    case 'treatments':
      return <TreatmentsMenu />;
    case 'finance':
      return <MoneyMenu />;
    case 'policy':
      return <PolicyMenu />;
    case 'stats':
      return <StatsMenu />;
  }
}

/** Whichever build menu is open, popping in when it opens and for a moment after it shuts shrinking away. */
export function Menu() {
  const { menu } = useHud();
  const pop = usePop(menu !== null);
  const { shown, leaving } = useExit(menu);
  return (
    <div id="menu" class={cx(menuStyle, pop, leaving && 'leaving')}>
      {shown && (
        <Still key={shown} still={leaving}>
          {contents(shown)}
        </Still>
      )}
    </div>
  );
}
