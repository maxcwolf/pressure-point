// The report after a VIP's visit or an inspection.

import './VisitDialog.css';

import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { reportHeading, reportSummary, verdictTone } from '../../lib/visits';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
import { Dialog } from './Dialog';

/** How the last visit went: the verdict, and each room the visitor saw with what they made of it. */
export function VisitDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const report = sim.s.visitReport;
  if (!report) return null;
  return (
    <Dialog wide>
      <h2>
        <Line line={reportHeading(report)} />
      </h2>
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
      {report.bribe === undefined ? (
        <Button
          class="go"
          onPress={() => {
            hud.close();
          }}
        >
          Back to work
        </Button>
      ) : (
        <div class="btnrow">
          <Button
            class="go"
            onPress={() => {
              sim.settleInspection(false);
              hud.close();
            }}
          >
            {`Pay the fine (${money(-report.money)})`}
          </Button>
          <Button
            class="bribe"
            locked={sim.s.money < report.bribe}
            title={
              sim.s.money < report.bribe
                ? "You can't afford it"
                : 'The inspection counts as passed, with no fine and no hit to reputation. Word of it may get out.'
            }
            onPress={() => {
              if (sim.settleInspection(true)) hud.close();
            }}
          >
            <IconText id="ui-bribe">{`Make it go away (${money(report.bribe)})`}</IconText>
          </Button>
        </div>
      )}
    </Dialog>
  );
}
