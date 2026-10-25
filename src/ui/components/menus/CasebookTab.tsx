// The Stats menu's Casebook tab: how visits have ended, condition by condition.

import { conditionOf, MODALITIES } from '../../../core/data';
import { useGame, useHud } from '../../hooks/use-hud';
import { cureShare, seen } from '../../lib/casebook';
import { cx } from '../../lib/cx';
import { CASEBOOK_SORTS, type CaseRow, sorted } from '../../lib/sorts';
import { IconText } from '../common/Icon';
import { SortBy } from '../common/SortBy';
import { statsHead, table } from './looks';

/** A row for each condition seen, most often seen first or in the order picked. */
export function CasebookTab() {
  const hud = useHud();
  const { sim } = useGame();
  const rows = sorted(Object.entries(sim.s.casebook) as CaseRow[], CASEBOOK_SORTS, hud.sorts.casebook);
  if (!rows.length) return <p class="sub">Nobody has left yet. Each visit is entered here as the guest goes.</p>;
  return (
    <>
      <div class={statsHead}>
        <p class="sub">Every visit since the center opened, by the condition the guest came in with.</p>
        {rows.length > 1 && <SortBy list="casebook" orders={CASEBOOK_SORTS} />}
      </div>
      {/* `casebook` is for the end-to-end tests */}
      <table class={cx('casebook', table)}>
        <thead>
          <tr>
            <th>Condition</th>
            <th>Seen</th>
            <th>Healed</th>
            <th>Not healed</th>
            <th>Stormed out</th>
            <th>Sent home</th>
            <th>Put off by price</th>
            <th>Got worse</th>
            <th>Cure rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, c]) => {
            const cond = conditionOf(id);
            const rate = cureShare(c);
            return (
              <tr key={id}>
                <td>
                  <IconText id={MODALITIES[cond.modality].icon}>{cond.name}</IconText>
                </td>
                <td>{seen(c)}</td>
                <td>{c.healed}</td>
                <td>{c.failed}</td>
                <td>{c.stormed}</td>
                <td>{c.sent}</td>
                <td>{c.priced}</td>
                <td>{c.worse}</td>
                <td class={cx(rate !== null && rate < 60 && 'poor')}>{rate === null ? '–' : `${rate}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
