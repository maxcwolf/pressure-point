// The Stats menu's Reputation tab: the center's reputation, what it is made of, and what guests are saying.

import { PART_NAMES, REPUTATION_PARTS, REVIEWS_KEPT } from '../../../core/data';
import { dateOf } from '../../../core/format';
import { reputationParts } from '../../../core/sim/feelings';
import { useGame } from '../../hooks/use-hud';
import { starText } from '../../lib/casebook';
import { Bar } from '../common/Bar';

/** One part of the reputation, as a bar, or a note that nobody has mentioned it yet. */
function Part({ name, desc, score }: { name: string; desc: string; score: number | null }) {
  return (
    <div class="rep-part">
      <span>
        <b>{name}</b> <small>{desc}</small>
      </span>
      {score === null ? (
        <small class="none">Not mentioned yet</small>
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
    <div class="reputation">
      <p class="sub">
        {`Reputation is ${Math.round(s.reputation)}%. It is what brings guests in and what goals count. The parts below show where it comes from, going by the last ${REVIEWS_KEPT} reviews.`}
      </p>
      <div class="rep-parts">
        {REPUTATION_PARTS.map((p) => (
          <Part key={p} name={PART_NAMES[p].name} desc={PART_NAMES[p].desc} score={parts[p]} />
        ))}
        <Part name="Word of mouth" desc="The stars guests give" score={parts.word} />
      </div>
      <h4>What guests are saying</h4>
      {s.reviews.length ? (
        <ul class="reviews">
          {s.reviews
            .slice(-8)
            .reverse()
            .map((r, i) => {
              const d = dateOf(r.day, s.startMonth);
              return (
                <li key={`${r.day}-${i}`}>
                  <span class="review-stars">{starText(r.stars)}</span>
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
