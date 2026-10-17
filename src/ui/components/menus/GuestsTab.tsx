// The Stats menu's Guests tab: which discipline new guests come for, and what draws them to each.

import { DISCIPLINES } from '../../../core/data';
import { type DisciplineDemand, lineArrivals } from '../../../core/sim/demand';
import { useGame } from '../../hooks/use-hud';
import {
  DEMAND_INTRO,
  demandAdvice,
  followingWord,
  lineNote,
  lineWord,
  offeringNote,
  popularityWord,
  roomWord,
  times,
  trainingWord,
} from '../../lib/demand';
import { Bar } from '../common/Bar';

/** One thing that draws guests to a discipline: what it is, what it comes to, and how it multiplies the pull. */
function Factor({ name, value, by, bar }: { name: string; value: string; by: number; bar?: number }) {
  return (
    <div class={by < 0.95 ? 'factor low' : by > 1.05 ? 'factor high' : 'factor'}>
      <small>{name}</small>
      <b>{value}</b>
      {bar !== undefined && <Bar value={bar} class="thin gold" />}
      <em>{times(by)}</em>
    </div>
  );
}

/** A discipline's share of new guests, the factors behind it, and what would draw more. */
function Row({ row, healed }: { row: DisciplineDemand; healed: number }) {
  const def = DISCIPLINES[row.discipline];
  const advice = demandAdvice(row);
  return (
    <div class="demand-row">
      <div class="demand-head">
        <b>{`${def.icon} ${def.name}`}</b>
        <Bar value={row.share * 100} class="blue" />
        <em>{`${Math.round(row.share * 100)}% of new guests`}</em>
      </div>
      <div class="factors">
        <Factor name="Popularity" value={popularityWord(row.popularity)} by={row.popularity} />
        <Factor
          name="Following"
          value={`${followingWord(row.following)} · ${Math.round(row.following)}`}
          by={row.followed}
          bar={row.following}
        />
        <Factor name="Finest room" value={roomWord(row)} by={row.room.pull} />
        <Factor name="Trained for" value={trainingWord(row)} by={row.training} />
        {Math.abs(row.flavour - 1) > 0.02 && <Factor name="Local favourites" value="This center" by={row.flavour} />}
        <Factor name="Line" value={lineWord(row)} by={row.line.factor} />
      </div>
      <p class="sub">
        {`Healed this month: ${healed}.`}
        {advice ? ` ${advice}` : ''}
      </p>
    </div>
  );
}

/** Each discipline on offer, most wanted first. */
export function GuestsTab() {
  const { sim } = useGame();
  const rows = sim.demand().sort((a, b) => b.share - a.share);
  const offering = sim.offering();
  const away = lineNote(lineArrivals(rows));
  if (!rows.length) return <p class="sub">No treatment rooms yet: build one, and guests start arriving for it.</p>;
  return (
    <div class="demand">
      <p class="sub">{DEMAND_INTRO}</p>
      <p class="sub">{offeringNote(offering.staffed, offering.arrivals)}</p>
      {away && <p class="sub">{away}</p>}
      {rows.map((row) => (
        <Row key={row.discipline} row={row} healed={sim.s.tally.healedBy[row.discipline] ?? 0} />
      ))}
      {sim.enabled('qigong') && (
        <p class="sub">
          Qi Gong classes draw class-goers of their own, on top of these, by the studio and its Instructor.
        </p>
      )}
    </div>
  );
}
