// Top left: the objectives for the next star, and the emergency in progress.

import './Objectives.css';

import { centerOf, conditionOf } from '../../core/data';
import { useGame } from '../hooks/use-hud';
import { Bar } from './common/Bar';
import { StarRow } from './common/Stars';

/** The objectives for the next star, with the emergency in progress under them. */
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
          objectives.map((o) => (
            <li key={o.label} class={o.done ? 'done' : ''}>
              <b>{o.done ? '✔' : '○'}</b>
              <span>
                {o.label}
                <Bar value={o.progress * 100} class="thin" />
              </span>
            </li>
          ))
        ) : (
          <li class="done">
            <b>✔</b>
            <span>Nothing left to prove. For now.</span>
          </li>
        )}
      </ul>
      {emergency && (
        <div class="emergency">
          <b>{`🚨 Emergency: ${conditionOf(emergency.condition).name}`}</b>{' '}
          <span>
            {`${emergency.healed}/${emergency.target} healed · ${Math.max(0, Math.ceil(emergency.deadline - s.day))} days left`}
          </span>
          <Bar value={(emergency.healed / emergency.target) * 100} class="thin bad" />
        </div>
      )}
    </div>
  );
}
