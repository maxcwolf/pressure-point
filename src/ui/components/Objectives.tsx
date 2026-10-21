// Top left: the objectives for the next star, and the emergency in progress.

import './Objectives.css';

import { useState } from 'preact/hooks';

import { centerOf, conditionOf, type GoalSpec } from '../../core/data';
import { money } from '../../core/format';
import type { Objective } from '../../core/sim/goals';
import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { wholeDaysLeft } from '../lib/emergency';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
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
      <b>{`🎯 ${ch.staffName}'s challenge`}</b>{' '}
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
      <b>😰 Stress outbreak</b>{' '}
      <span>
        {`${o.calms} calming session${o.calms === 1 ? '' : 's'} left · ${o.lost}/${o.lostMax} lost · ${wholeDaysLeft(o.deadline - sim.s.day)} days left`}
      </span>
      <Bar value={(1 - o.lost / (o.lostMax + 1)) * 100} class="thin bad" />
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
      <ChallengeCard />
      <OutbreakCard />
      {emergency && (
        <div class="emergency">
          <b>{`🚨 Emergency: ${conditionOf(emergency.condition).name}`}</b>{' '}
          <span>
            {`${emergency.healed}/${emergency.target} healed · ${wholeDaysLeft(emergency.deadline - s.day)} days left`}
          </span>
          <Bar value={(emergency.healed / emergency.target) * 100} class="thin bad" />
        </div>
      )}
    </div>
  );
}
