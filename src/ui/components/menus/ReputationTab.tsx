// The Stats menu's Reputation tab: the center's reputation, what it is made of, and what guests are saying.

import { PART_NAMES, REPUTATION_PARTS, REVIEWS_KEPT } from '../../../core/data';
import { dateOf } from '../../../core/format';
import { reputationParts } from '../../../core/sim/feelings';
import { css } from '../../../styled-system/css';
import { useGame } from '../../hooks/use-hud';
import { starText } from '../../lib/casebook';
import { cx } from '../../lib/cx';
import { Bar } from '../common/Bar';

/** The parts, as many to a line as fit. */
const partCards = css({
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fill, minmax(220px, 1fr))]',
  gap: '8',
  m: '0',
  mt: '8',
  mb: '10',
});

/** A part's card: its name and what it is over the whole width, then its bar and its share. */
const part = css({
  display: 'grid',
  gridTemplateColumns: '[1fr auto]',
  alignItems: 'center',
  columnGap: '8',
  bg: 'white',
  border: '[2px solid {colors.ink.20}]',
  borderRadius: '10',
  py: '6',
  px: '10',
  fontSize: '13',
  '& span': { gridColumn: '[1 / -1]' },
  '& small': { fontSize: '12', opacity: '[0.8]' },
  '& em': { fontStyle: 'normal', fontWeight: 'bold' },
});

/** The reviews, as cards as many to a line as fit: the stars, the words, and who wrote it when. */
const reviews = css({
  listStyle: 'none',
  p: '0',
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fill, minmax(220px, 1fr))]',
  gap: '6',
  '& li': {
    bg: 'white',
    border: '[2px solid {colors.ink.20}]',
    borderRadius: '10',
    py: '6',
    px: '10',
    fontSize: '13',
    display: 'flex',
    flexDirection: 'column',
    gap: '2',
  },
  '& small': { fontSize: '12', opacity: '[0.75]' },
});

/** A review's stars, in gold outlined in navy. */
const stars = css({ color: 'gold', WebkitTextStroke: '[0.6px {colors.navy}]', letterSpacing: '[1px]' });

/** One part of the reputation, as a bar, or a note that nobody has mentioned it yet. */
function Part({ name, desc, score }: { name: string; desc: string; score: number | null }) {
  return (
    <div class={part}>
      <span>
        <b>{name}</b> <small>{desc}</small>
      </span>
      {score === null ? (
        <small>Not mentioned yet</small>
      ) : (
        <>
          <Bar value={score} class={score < 40 ? 'bad' : 'gold'} />
          <em>{`${score}%`}</em>
        </>
      )}
    </div>
  );
}

/** The reputation, part by part from the latest reviews, and the reviews themselves, newest first. */
export function ReputationTab() {
  const { sim } = useGame();
  const s = sim.s;
  const parts = reputationParts(s.reviews);
  return (
    <div>
      <p class="sub">
        {`Reputation is ${Math.round(s.reputation)}%. It is what brings guests in and what goals count. The parts below show where it comes from, going by the last ${REVIEWS_KEPT} reviews.`}
      </p>
      <div class={partCards}>
        {REPUTATION_PARTS.map((p) => (
          <Part key={p} name={PART_NAMES[p].name} desc={PART_NAMES[p].desc} score={parts[p]} />
        ))}
        <Part name="Word of mouth" desc="The stars guests give" score={parts.word} />
      </div>
      <h4>What guests are saying</h4>
      {s.reviews.length ? (
        // `reviews` is for the end-to-end tests
        <ul class={cx('reviews', reviews)}>
          {s.reviews
            .slice(-8)
            .reverse()
            .map((r, i) => {
              const d = dateOf(r.day, s.startMonth);
              return (
                <li key={`${r.day}-${i}`}>
                  <span class={stars}>{starText(r.stars)}</span>
                  <q>{r.text}</q>
                  <small>{`${r.name}, day ${d.day} of month ${d.month}`}</small>
                </li>
              );
            })}
        </ul>
      ) : (
        <p class="sub">No reviews yet. Guests write one as they leave.</p>
      )}
    </div>
  );
}
