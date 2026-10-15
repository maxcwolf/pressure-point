// The Stats menu's Regulars tab: the guests who come back, how loyal each has grown, and when they are next in.

import { LOYALTY_NAMES, REGULARS_MAX } from '../../../core/data';
import { loyaltyLevel, regularHere } from '../../../core/sim/regulars';
import { useGame } from '../../hooks/use-hud';
import { loyaltyNote } from '../../lib/regulars';
import { Bar } from '../common/Bar';

/** A row for each regular, the most loyal first. */
export function RegularsTab() {
  const { sim } = useGame();
  const s = sim.s;
  const rows = [...s.regulars].sort((a, b) => b.loyalty - a.loyalty);
  if (!rows.length)
    return (
      <p class="sub">
        No regulars yet. Now and then a guest who enjoyed their visit comes back every few weeks, and is listed here.
        Anyone a Shaman’s Vision Quest heals comes back too.
      </p>
    );
  return (
    <>
      <p class="sub">
        {`Guests who come back every few weeks, up to ${REGULARS_MAX} at a time. Good visits make them loyal: more patient, sooner back, and they tip. A bad visit or two and they stop coming.`}
      </p>
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
