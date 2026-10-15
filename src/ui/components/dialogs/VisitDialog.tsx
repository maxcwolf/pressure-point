// The report after a VIP's visit or an inspection.

import './VisitDialog.css';

import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { reportHeading, reportSummary, verdictTone } from '../../lib/visits';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

/** How the last visit went: the verdict, and each room the visitor saw with what they made of it. */
export function VisitDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const report = sim.s.visitReport;
  if (!report) return null;
  return (
    <Dialog wide>
      <h2>{reportHeading(report)}</h2>
      <p>{reportSummary(report)}</p>
      <ul class="visit-rooms">
        {report.rooms.map((r) => (
          <li key={r.room} class={cx(verdictTone(r))}>
            <b>{r.name}</b>
            <small>{r.note}</small>
            {report.visit === 'vip' && <em>{r.score}</em>}
          </li>
        ))}
      </ul>
      <Button
        class="go"
        onPress={() => {
          hud.close();
        }}
      >
        Back to work
      </Button>
    </Dialog>
  );
}
