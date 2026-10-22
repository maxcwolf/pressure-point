// The Stats menu's Guests tab: which discipline new guests come for, and what draws them to each.

import { centerOf, DISCIPLINES } from '../../../core/data';
import type { DisciplineDemand } from '../../../core/sim/demand';
import { guestsCounted } from '../../../core/sim/guests';
import { useGame } from '../../hooks/use-hud';
import {
  capacityNote,
  DEMAND_INTRO,
  demandAdvice,
  followingWord,
  limitNote,
  lineWord,
  paceNote,
  popularityWord,
  roomWord,
  times,
  trainingWord,
} from '../../lib/demand';
import { rushLine, seasonLine } from '../../lib/seasons';
import { Bar } from '../common/Bar';
import { IconText } from '../common/Icon';

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
        <b>
          <IconText id={def.icon}>{def.name}</IconText>
        </b>
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
  const pace = sim.arrivalPace();
  const center = centerOf(sim.s);
  const limit = {
    building: sim.guestCap(),
    own: sim.s.intakeCap,
    inside: guestsCounted(sim.s),
    away: sim.s.tally.turnedAway ?? 0,
  };
  const idle = capacityNote(pace.capacity);
  const season = seasonLine(sim.s.day, center);
  const rush = rushLine(sim.s.day, center);
  if (!rows.length) return <p class="sub">No treatment rooms yet: build one, and guests start arriving for it.</p>;
  return (
    <div class="demand">
      <p class="sub">{DEMAND_INTRO}</p>
      <p class="sub">{paceNote(pace, sim.s.reputation, center)}</p>
      <p class="sub">{limitNote(limit, pace.capacity)}</p>
      {idle && <p class="sub">{idle}</p>}
      {season && (
        <p class="sub seasons">
          <IconText id="ui-date">{season}</IconText>
        </p>
      )}
      {rush && (
        <p class="sub seasons">
          <IconText id="ui-date">{rush}</IconText>
        </p>
      )}
      {rows.map((row) => (
        <Row key={row.discipline} row={row} healed={sim.s.tally.healedBy[row.discipline] ?? 0} />
      ))}
      {sim.enabled('qigong') && (
        <p class="sub">
          Qi Gong classes draw class-goers of their own, on top of these, by your reputation and the Instructor’s rank.
        </p>
      )}
    </div>
  );
}
