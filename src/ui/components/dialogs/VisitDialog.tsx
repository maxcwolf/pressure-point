// The report after a VIP's visit or an inspection.

import { money } from '../../../core/format';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { reportHeading, reportSummary, verdictTone } from '../../lib/visits';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
import { Dialog } from './Dialog';

/**
 * The rooms a visitor saw, each a card with its name and their note on it, the VIP's score to the right; a room they
 * loved is gold, and one they did not like red. The visitor's inspector lists them the same way. `visit-rooms`, on the
 * dialog's list, is for the end-to-end tests to find it by.
 */
export const visitRooms = css({
  listStyle: 'none',
  p: 'none',
  m: '[10px 0]',
  display: 'grid',
  gap: 's',
  textAlign: 'left',
  '& li': {
    display: 'grid',
    gridTemplateColumns: '[1fr auto]',
    alignItems: 'center',
    columnGap: 'm',
    border: '[2px solid rgba(36, 56, 74, 0.25)]',
    borderRadius: '[10px]',
    p: '[5px 9px]',
    bg: 'white',
  },
  '& li.good': { borderColor: 'gold', bg: '[#fff6dc]' },
  '& li.bad': { borderColor: '[#d97a6c]', bg: '[#fdecea]' },
  '& small': { gridColumn: '1', fontSize: '[12px]', lineHeight: '[1.25]' },
  '& em': { gridColumn: '2', gridRow: '[1 / span 2]', fontStyle: 'normal', fontWeight: '[700]', fontSize: '[16px]' },
});

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
      <ul class={cx('visit-rooms', visitRooms)}>
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
          class={goButton()}
          onPress={() => {
            hud.close();
          }}
        >
          Back to work
        </Button>
      ) : (
        <div class={buttonRow()}>
          <Button
            class={goButton()}
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
