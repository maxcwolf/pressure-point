// Top left: the objectives for the next star, the tutorial's steps or what a first game will need soon, and the
// emergency in progress.

import './Objectives.css';

import { useState } from 'preact/hooks';

import { centerOf, conditionOf, type GoalSpec } from '../../core/data';
import { money } from '../../core/format';
import type { Objective } from '../../core/sim/goals';
import type { TutorialLine } from '../../core/sim/tutorial';
import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { wholeDaysLeft } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { StarRow } from './common/Stars';

/** One objective: its label and progress, and on a click the numbers behind it, a line each. */
function ObjectiveRow({ objective: o, goal }: { objective: Objective; goal: GoalSpec | undefined }) {
  const { sim } = useGame();
  const [open, setOpen] = useState(false);
  const detail = open && goal ? sim.objectiveDetail(goal) : null;
  return (
    <li class={cx(o.done && 'done', open && 'open')}>
      <b>{o.done ? '✔' : '○'}</b>
      <span>
        <Button
          class="objective"
          title={open ? 'Hide the numbers behind this objective' : 'Show the numbers behind this objective'}
          onPress={() => {
            setOpen(!open);
          }}
        >
          {o.label}
        </Button>
        <Bar value={o.progress * 100} class="thin" />
        {detail && (
          <ul class="detail">
            {detail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </span>
    </li>
  );
}

/** The challenge a member of staff has set, if any: what it asks, how far along it is, and the days left. */
function ChallengeCard() {
  const { sim } = useGame();
  const ch = sim.s.challenge;
  const o = sim.challengeObjective();
  if (!ch || !o) return null;
  return (
    <div class="challenge">
      <b>
        <IconText id="ui-target">{`${ch.staffName}'s challenge`}</IconText>
      </b>{' '}
      <span>{`${o.label} · ${wholeDaysLeft(ch.deadline - sim.s.day)} days left · ${money(ch.reward)}`}</span>
      <Bar value={o.progress * 100} class="thin gold" />
    </div>
  );
}

/** The stress outbreak in progress, if any: calming sessions left, carriers lost so far, and the days left. */
function OutbreakCard() {
  const { sim } = useGame();
  const o = sim.s.outbreak;
  if (!o) return null;
  return (
    <div class="emergency outbreak">
      <b>
        <IconText id="bubble-stressed">Stress outbreak</IconText>
      </b>{' '}
      <span>
        {`${o.calms} calming session${o.calms === 1 ? '' : 's'} left · ${o.lost}/${o.lostMax} lost · ${wholeDaysLeft(o.deadline - sim.s.day)} days left`}
      </span>
      <Bar value={(1 - o.lost / (o.lostMax + 1)) * 100} class="thin bad" />
    </div>
  );
}

/** On a first go at the campaign, what the center will need soon, ticked off as each is in place. */
function GettingReady() {
  const { sim } = useGame();
  const lines = sim.primerLines();
  if (!lines.length) return null;
  return (
    <div class="getting-ready">
      <h4>Getting ready</h4>
      <ul>
        {lines.map((l) => (
          <li key={l.id} class={cx(l.done && 'done')}>
            <b>{l.done ? '✔' : '○'}</b>
            <span>{l.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How many steps to come the tutorial's list shows past the one in hand, until it is opened out. */
const STEPS_AHEAD = 2;

/**
 * While the tutorial is on, its steps: those done ticked, the one in hand in bold and the rest grey, folded to the
 * ones done, the one in hand and the next couple until opened out.
 */
function TutorialList() {
  const { sim } = useGame();
  const [open, setOpen] = useState(false);
  const lines = sim.tutorialLines();
  if (!lines.length) return null;
  const done = lines.filter((l) => l.done).length;
  const at = lines.findIndex((l) => l.current);
  // with no step in hand, the next are those after the last done
  const from = at >= 0 ? at + 1 : lines.findIndex((l) => !l.done);
  /** Whether a line shows while the list is folded. */
  const folded = (l: TutorialLine, i: number) =>
    l.done || l.current || (from >= 0 && i >= from && i < from + STEPS_AHEAD);
  const shown = open ? lines : lines.filter(folded);
  const more = lines.length - shown.length;
  return (
    <div class="getting-ready tutorial-list">
      <h4>{`Tutorial · ${done} of ${lines.length} done`}</h4>
      <ul>
        {shown.map((l) => (
          <li key={l.id} class={cx(l.done && 'done', l.current && 'current', !l.done && !l.current && 'ahead')}>
            <b>{l.done ? '✔' : '○'}</b>
            <span>{l.label}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Button
          class="objective more"
          onPress={() => {
            setOpen(true);
          }}
        >
          {`${more} more`}
        </Button>
      )}
    </div>
  );
}

/** The objectives for the next star, with the staff challenge and the emergency in progress under them. */
export function Objectives() {
  const { sim } = useGame();
  const s = sim.s;
  const objectives = sim.objectives();
  const emergency = s.emergency;
  const goals = centerOf(s).goals;
  return (
    <div id="objectives" class="panel">
      {s.center !== 'sandbox' && <p class="center-name">{centerOf(s).name}</p>}
      <h3>{goals[s.stars] ? `Star ${s.stars + 1} objectives` : 'All stars earned!'}</h3>
      <div class="stars">
        <StarRow earned={s.stars} of={goals.length} />
      </div>
      <ul>
        {objectives.length ? (
          objectives.map((o, i) => <ObjectiveRow key={o.label} objective={o} goal={goals[s.stars]?.[i]} />)
        ) : (
          <li class="done">
            <b>✔</b>
            <span>Nothing left to prove. For now.</span>
          </li>
        )}
      </ul>
      {s.tutorial ? <TutorialList /> : <GettingReady />}
      <ChallengeCard />
      <OutbreakCard />
      {emergency && (
        <div class="emergency">
          <b>
            <IconText id="ui-emergency">{`Emergency: ${conditionOf(emergency.condition).name}`}</IconText>
          </b>{' '}
          <span>
            {`${emergency.healed}/${emergency.target} healed · ${wholeDaysLeft(emergency.deadline - s.day)} days left`}
          </span>
          <Bar value={(emergency.healed / emergency.target) * 100} class="thin bad" />
        </div>
      )}
    </div>
  );
}
