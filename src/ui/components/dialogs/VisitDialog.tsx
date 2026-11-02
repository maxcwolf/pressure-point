// The report after a VIP's visit or an inspection.

import { money } from '../../../core/format';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import {
  inspectionRule,
  offerLabel,
  problemNote,
  problemSpot,
  refusalNote,
  reportHeading,
  reportSummary,
  verdictTone,
  warningNote,
} from '../../lib/visits';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
import { Dialog } from './Dialog';

/**
 * The rooms a visitor saw, each a card with its name and their note on it, the VIP's score to the right; a room they
 * loved is gold, and one they did not like red. For the inspector, a room with something wrong lists each thing, and
 * what to do about it, with Show me to the right. The visitor's inspector lists them the same way. `visit-rooms`, on
 * the dialog's list, is for the end-to-end tests to find it by.
 */
export const visitRooms = css({
  listStyle: 'none',
  p: '0',
  my: '10',
  mx: '0',
  display: 'grid',
  gap: '6',
  textAlign: 'left',
  '& li': {
    display: 'grid',
    gridTemplateColumns: '[1fr auto]',
    alignItems: 'center',
    columnGap: '8',
    border: 'divider',
    borderRadius: '10',
    py: '4',
    px: '8',
    bg: 'bg.card',
  },
  '& li.good': { borderColor: 'highlight', bg: 'highlight.bg' },
  '& li.bad': { borderColor: 'bad.border', bg: 'bad.bg' },
  '& small': { gridColumn: '1', fontSize: '12', lineHeight: 'snug' },
  '& small + small': { mt: '2' },
  '& em': { gridColumn: '2', gridRow: '[1 / span 2]', fontStyle: 'normal', fontWeight: 'heavy', fontSize: '17' },
  '& li > button': { gridColumn: '2', gridRow: '[1 / span 4]', fontSize: '13' },
});

/** The warning in place of a first failed inspection's fine: on a warm tint, to stand out from the summary. */
const warning = css({
  borderRadius: '10',
  py: '6',
  px: '10',
  bg: 'warn.bg',
  color: 'warn',
  fontWeight: 'bold',
  textAlign: 'left',
});

/** The offers to make a failed inspection go away: a little smaller than the row's usual buttons, to sit side by side. */
const offers = css({ '& button': { fontSize: '15', px: '14' } });

/** The words between paying the fine and the offers, close to both. */
const between = css({ mt: '10', mb: '0' });

/**
 * How the last visit went: the verdict, and each room the visitor saw with what they made of it. A failed inspection
 * lists what was wrong where, and what to do about it; one still to be settled offers the fine or a few offers to make
 * it go away, and once settled shows how that went before going back to work.
 */
export function VisitDialog() {
  const hud = useHud();
  const { sim } = useGame();
  const report = sim.s.visitReport;
  if (!report) return null;
  const { bribes } = report;
  const inspection = report.visit === 'inspector';
  return (
    <Dialog wide>
      <h2>
        <Line line={reportHeading(report)} />
      </h2>
      <p>{reportSummary(report)}</p>
      {report.outcome === 'warned' && <p class={cx('warning', warning)}>{warningNote(report)}</p>}
      {inspection && report.score > 0 && <p class="sub">{inspectionRule()}</p>}
      <ul class={cx('visit-rooms', visitRooms)}>
        {report.rooms.map((r) => {
          const spot = bribes ? null : problemSpot(sim.s, r);
          return (
            <li key={r.room} class={cx(verdictTone(r))}>
              <b>{r.name}</b>
              {r.problems.length ? (
                r.problems.map((p) => {
                  const { what, fix } = problemNote(p);
                  return (
                    <small key={p}>
                      <b>{`${what}.`}</b>
                      {fix && ` ${fix}`}
                    </small>
                  );
                })
              ) : (
                <small>{r.note}</small>
              )}
              {report.visit === 'vip' && <em>{r.score}</em>}
              {spot && (
                <Button
                  quiet
                  onPress={() => {
                    hud.close();
                    hud.show(spot);
                  }}
                >
                  Show me
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {bribes ? (
        <>
          <div class={buttonRow()}>
            <Button
              class={goButton()}
              onPress={() => {
                sim.settleInspection();
                hud.update();
              }}
            >
              {`Pay the fine (${money(-report.money)})`}
            </Button>
          </div>
          <p class={cx('sub', between)}>{refusalNote(report)}</p>
          <div class={cx(buttonRow(), offers)}>
            {bribes.map((price, i) => (
              <Button
                key={price}
                class="bribe"
                locked={sim.s.money < price}
                title={
                  sim.s.money < price
                    ? "You can't afford it"
                    : 'If it is taken, the inspection counts as passed, with no fine and no hit to reputation.'
                }
                onPress={() => {
                  if (sim.settleInspection(i)) hud.update();
                }}
              >
                <IconText id="ui-bribe">{offerLabel(price, i)}</IconText>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <Button
          class={goButton()}
          onPress={() => {
            hud.close();
          }}
        >
          Back to work
        </Button>
      )}
    </Dialog>
  );
}
