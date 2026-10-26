// The Stats menu's Standing tab: the center's grade, how far it is to the next, what it brings, and the rival.

import { GRADES, RIVAL_NAME, RIVAL_SLOGAN, SALE_DISCOUNT } from '../../../core/data';
import { dateOf } from '../../../core/format';
import { onSale, rivalDraw, rivalGrade, rivalPoints } from '../../../core/sim/rival';
import { gradeDef, idleNote } from '../../../core/sim/standing';
import { css } from '../../../styled-system/css';
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

/** The tab: the grade large at the top, headings partway down with room over them, and the bar to the next grade. */
const standing = css({
  '& h4': { fontWeight: 'bold', m: '0', mt: '10', mb: '4' },
  '& .grade-now': { fontSize: '17', mt: '0' },
  '& label': { display: 'block', m: '0', mt: '8', mb: '2', fontSize: '13' },
});

/**
 * The grades, five to a line, or three in a narrower window: faint until reached, and the one the center is at in
 * gold, with the points each takes.
 */
const grades = css({
  listStyle: 'none',
  p: '0',
  display: 'grid',
  gridTemplateColumns: '[repeat(5, minmax(0, 1fr))]',
  gap: '6',
  m: '0',
  mt: '8',
  mb: '4',
  '& li': {
    display: 'flex',
    flexDirection: 'column',
    bg: 'bg.card',
    border: 'divider',
    borderRadius: '10',
    py: '4',
    px: '8',
    fontSize: '13',
    opacity: 'quiet',
  },
  '& li.reached': { opacity: 'full' },
  '& li.now': { bg: 'highlight.bg', borderColor: 'highlight', fontWeight: 'bold' },
  '& small': { fontSize: '11', fontWeight: 'regular', opacity: 'soft' },
  _max1100: { gridTemplateColumns: '[repeat(3, minmax(0, 1fr))]' },
});

/** What the grade brings, as a list. */
const effects = css({ m: '0', mb: '4', ml: '16', fontSize: '13' });

/**
 * The rival's card: its slogan in italics, the center's standing and the rival's side by side as bars, and its sale in
 * red while it has one on.
 */
const rival = css({
  mt: '12',
  bg: 'bg.card',
  border: 'divider',
  borderRadius: '12',
  py: '8',
  px: '12',
  // `&.rival` out-specifies the Standing tab's own `& h4`, whose atomic class would otherwise win
  '&.rival h4': { mt: '0' },
  '& .slogan': { fontStyle: 'italic' },
  '& .versus': {
    display: 'grid',
    gridTemplateColumns: '[auto 1fr auto]',
    alignItems: 'center',
    columnGap: '8',
    rowGap: '4',
    my: '6',
    mx: '0',
    fontSize: '13',
  },
  '& .versus em': { fontStyle: 'normal', fontWeight: 'bold' },
  '& .sale': { color: 'bad.solid', fontWeight: 'bold' },
});

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
    <div class={cx('rival', rival)}>
      <h4>
        <IconText id="ui-rival">{`${RIVAL_NAME}, across the street`}</IconText>
      </h4>
      <p class="sub">{rivalOpening(r.opened, s.rivalOn, s.startMonth)}</p>
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
              ? `Holding a sale: ${Math.round(SALE_DISCOUNT * 100)}% off until day ${dateOf(r.saleUntil, s.startMonth).day} of month ${dateOf(r.saleUntil, s.startMonth).month}. Lower your prices to keep your guests.`
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
    <div class={standing}>
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
      <ol class={grades}>
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
      <ul class={effects}>
        {gradeEffects(s.grade).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Rival />
    </div>
  );
}
