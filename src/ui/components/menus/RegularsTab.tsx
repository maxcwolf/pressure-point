// The Stats menu's Regulars tab: the guests who come back, how loyal each has grown, and when they are next in.

import { LOYALTY_NAMES, REGULARS_MAX } from '../../../core/data';
import { loyaltyLevel, regularHere } from '../../../core/sim/regulars';
import { useGame, useHud } from '../../hooks/use-hud';
import { loyaltyNote } from '../../lib/regulars';
import { REGULAR_SORTS, sorted } from '../../lib/sorts';
import { Bar } from '../common/Bar';
import { SortBy } from '../common/SortBy';

/** A row for each regular, the most loyal first or in the order picked. */
export function RegularsTab() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const rows = sorted(s.regulars, REGULAR_SORTS, hud.sorts.regulars);
  if (!rows.length)
    return (
      <p class="sub">
        No regulars yet. Now and then a guest who enjoyed their visit comes back every few weeks, and is listed here.
        Anyone a Shaman’s Vision Quest heals comes back too.
      </p>
    );
  return (
    <>
      <div class="stats-head">
        <p class="sub">
          {`Guests who come back every few weeks, up to ${REGULARS_MAX} at a time. Good visits make them loyal: more patient, sooner back, and they tip. A bad visit or two and they stop coming.`}
        </p>
        {rows.length > 1 && <SortBy list="regulars" orders={REGULAR_SORTS} />}
      </div>
      <table class="casebook regulars">
        <thead>
          <tr>
            <th>Regular</th>
            <th>Visits</th>
            <th>Loyalty</th>
            <th>Next visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.visits}</td>
              <td class="loyalty">
                <span>{LOYALTY_NAMES[loyaltyLevel(r.loyalty)]}</span>
                <Bar value={r.loyalty} class={r.loyalty < 20 ? 'bad' : ''} />
              </td>
              <td>{loyaltyNote(r, s.day, regularHere(s, r))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
