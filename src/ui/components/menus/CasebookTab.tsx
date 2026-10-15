// The Stats menu's Casebook tab: how visits have ended, condition by condition.

import { type ConditionId, conditionOf, MODALITIES } from '../../../core/data';
import type { CaseRecord } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cureShare, seen } from '../../lib/casebook';
import { cx } from '../../lib/cx';

/** A row for each condition seen, most often seen first. */
export function CasebookTab() {
  const { sim } = useGame();
  const rows = (Object.entries(sim.s.casebook) as [ConditionId, CaseRecord][]).sort((a, b) => seen(b[1]) - seen(a[1]));
  if (!rows.length) return <p class="sub">Nobody has left yet. Each visit is entered here as the guest goes.</p>;
  return (
    <>
      <p class="sub">Every visit since the center opened, by the condition the guest came in with.</p>
      <table class="casebook">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Seen</th>
            <th>Healed</th>
            <th>Not healed</th>
            <th>Stormed out</th>
            <th>Sent home</th>
            <th>Put off by price</th>
            <th>Cure rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, c]) => {
            const cond = conditionOf(id);
            const rate = cureShare(c);
            return (
              <tr key={id}>
                <td>{`${MODALITIES[cond.modality].icon} ${cond.name}`}</td>
                <td>{seen(c)}</td>
                <td>{c.healed}</td>
                <td>{c.failed}</td>
                <td>{c.stormed}</td>
                <td>{c.sent}</td>
                <td>{c.priced}</td>
                <td class={cx(rate !== null && rate < 60 && 'poor')}>{rate === null ? '–' : `${rate}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
