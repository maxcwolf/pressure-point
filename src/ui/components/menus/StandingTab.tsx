// The Stats menu's Standing tab: the center's grade, how far it is to the next, what it brings, and the rival.

import { GRADES, RIVAL_NAME, RIVAL_SLOGAN, SALE_DISCOUNT } from '../../../core/data';
import { dateOf } from '../../../core/format';
import { onSale, rivalDraw, rivalGrade, rivalPoints } from '../../../core/sim/rival';
import { gradeDef, idleNote } from '../../../core/sim/standing';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import {
  counterplayLine,
  drawNote,
  gradeEffects,
  gradeProgress,
  rivalCourseLine,
  rivalOpening,
  standingLine,
} from '../../lib/standing';
import { Bar } from '../common/Bar';
import { IconText } from '../common/Icon';

/** The rival across the street: how it stands against the center, its sale, and what it has done so far. */
function Rival() {
  const { sim } = useGame();
  const s = sim.s;
  const r = s.rival;
  const open = s.rivalOn && r.opened !== null;
  const ours = sim.standing().total;
  const theirs = rivalPoints(s);
  const most = Math.max(ours, theirs, 1);
  const { course, ceiling } = sim.rivalCourse();
  return (
    <div class="rival">
      <h4>
        <IconText id="ui-rival">{`${RIVAL_NAME}, across the street`}</IconText>
      </h4>
      <p class="sub">{rivalOpening(r.opened, s.rivalOn)}</p>
      {open && (
        <>
          <p class="sub slogan">{`“${RIVAL_SLOGAN}.” A ${gradeDef(rivalGrade(s)).name}.`}</p>
          <div class="versus">
            <span>You</span>
            <Bar value={(ours / most) * 100} class="gold" />
            <em>{ours}</em>
            <span>{RIVAL_NAME}</span>
            <Bar value={(theirs / most) * 100} class="bad" />
            <em>{theirs}</em>
          </div>
          <p class="sub">{rivalCourseLine(course, ceiling)}</p>
          <p class="sub">{counterplayLine(r.knocked)}</p>
          <p class={cx('sub', onSale(s) && 'sale')}>
            {onSale(s)
              ? `Holding a sale: ${Math.round(SALE_DISCOUNT * 100)}% off until day ${dateOf(r.saleUntil).day} of month ${dateOf(r.saleUntil).month}. Lower your prices to keep your guests.`
              : 'No sale on.'}
          </p>
          <p class="sub">{drawNote(rivalDraw(s))}</p>
          <p class="sub">{`Staff hired away: ${r.poached} · Center of the Year awards won: ${r.trophies}`}</p>
        </>
      )}
    </div>
  );
}

/** The center's grade, the climb to the next, what each grade brings, and the rival. */
export function StandingTab() {
  const { sim } = useGame();
  const s = sim.s;
  const points = sim.standing();
  const here = gradeDef(s.grade);
  const progress = gradeProgress(points.total, s.grade);
  return (
    <div class="standing">
      <h4 class="grade-now">
        <IconText id={here.icon}>{here.name}</IconText>
      </h4>
      <p class="sub">
        Standing comes from the rooms you work in and how fine they are, the staff and their ranks, and every guest
        healed. A grade once reached is kept.
      </p>
      <label>
        {progress.next
          ? `${points.total} points · ${progress.needed} more to ${progress.next.name}`
          : `${points.total} points · the top grade`}
        <Bar value={progress.share * 100} class="gold" />
      </label>
      <p class="sub">{standingLine(points)}</p>
      {idleNote(points) && <p class="sub">{`${idleNote(points)}.`}</p>}
      <ol class="grades">
        {GRADES.map((g, i) => (
          <li key={g.name} class={cx(i <= s.grade && 'reached', i === s.grade && 'now')}>
            <span>
              <IconText id={g.icon}>{g.name}</IconText>
            </span>
            <small>{i === 0 ? 'Where everyone starts' : `${g.points} points`}</small>
          </li>
        ))}
      </ol>
      <h4>What it brings</h4>
      <ul class="grade-effects">
        {gradeEffects(s.grade).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Rival />
    </div>
  );
}
