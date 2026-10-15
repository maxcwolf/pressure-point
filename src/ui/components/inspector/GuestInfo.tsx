// The inspector for a guest.

import { CLASS_FEE, conditionOf, FEELINGS, MODALITIES, POOR_CONDITION, WEEKDAYS } from '../../../core/data';
import { money } from '../../../core/format';
import { weekday } from '../../../core/sim/classes';
import { regularOf } from '../../../core/sim/regulars';
import type { Guest } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { chanceText, percent, poorChance } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { regularTag } from '../../lib/regulars';
import { guestStatus } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { QualChips } from '../common/QualChips';

/** The chance a diagnosed guest's treatment works, if given now, or what it is waiting on. */
function ChanceLine({ guest: g }: { guest: Guest }) {
  const { sim } = useGame();
  if (g.goal !== 'treat') return null;
  const chance = sim.chanceFor(g);
  const staff = sim.staff(sim.world.item(g.station)?.staffId ?? 0);
  if (!chance || !staff) return <p class="sub chance">Chance of success: not known until someone is at the table</p>;
  const def = MODALITIES[conditionOf(g.condition).modality];
  return (
    <p class={cx('sub', 'chance', poorChance(chance) && 'poor')}>
      {`Chance of success: ${chanceText(chance, def, staff.name)}`}
    </p>
  );
}

/** During a stress outbreak, a calming session for this guest: wasted on one who was not stressed. */
function CalmButton({ guest: g }: { guest: Guest }) {
  const { sim, audio } = useGame();
  const o = sim.s.outbreak;
  if (!o || g.state === 'leaving') return null;
  if (g.calmed) return <p class="sub calmed">😌 Has had a calming session</p>;
  return (
    <Button
      class="go calm"
      locked={o.calms <= 0}
      title="Spot the stressed by their sweating and fidgeting. A session given to a guest who was fine is wasted."
      onPress={() => {
        if (!sim.calm(g.id)) audio.play('error');
      }}
    >
      {`😌 Calm them (${o.calms} left)`}
    </Button>
  );
}

/** A class-goer: the class they came for, what they are doing, how they are holding up and how they feel. */
function ClassgoerInfo({ guest: g }: { guest: Guest }) {
  const { sim } = useGame();
  return (
    <>
      <h3>{g.name}</h3>
      <p class="tag">☯️ Class-goer</p>{' '}
      <p>{`Here for ${WEEKDAYS[weekday(g.classDay)] ?? ''}’s Qi Gong class, at ${money(Math.round(CLASS_FEE * sim.priceFor('qigong')))} a place.`}</p>{' '}
      <p class="status">{guestStatus(g, sim)}</p>{' '}
      <label>
        Patience
        <Bar value={g.patience} class={g.patience < 25 ? 'bad' : ''} />
      </label>{' '}
      <Feelings guest={g} />
      <p class="sub">{`Spent so far: ${money(g.spent)}`}</p>
    </>
  );
}

/** What a guest has felt about their visit so far. */
function Feelings({ guest: g }: { guest: Guest }) {
  if (!g.feelings.length) return null;
  return (
    <>
      <h4>How they feel</h4>
      <div class="feelings">
        {g.feelings.map((f) => (
          <span key={f} class={FEELINGS[f].good ? 'good' : 'bad'}>{`${FEELINGS[f].icon} ${FEELINGS[f].text}`}</span>
        ))}
      </div>
    </>
  );
}

/** A guest's condition, what they are doing and how they are holding up. */
export function GuestInfo({ guest: g }: { guest: Guest }) {
  const { sim } = useGame();
  if (g.classDay) return <ClassgoerInfo guest={g} />;
  const c = conditionOf(g.condition);
  const sure = sim.s.policy.diagnosis;
  // the condition is a mystery until a consultation has settled it
  const known = g.goal === 'treat' || g.goal === 'leave';
  const regular = regularOf(sim.s, g);
  return (
    <>
      <h3>{g.name}</h3>
      <p class="tag">{g.emergency ? '🚨 Emergency guest' : regular ? regularTag(regular) : 'Guest'}</p>{' '}
      <p>
        <b>{known ? c.name : 'Undiagnosed'}</b>
        <br />
        {known ? c.desc : 'Something is clearly wrong. A consultation will reveal what.'}
      </p>{' '}
      {known && (
        <>
          <p class="sub">{`Treatment: ${c.treatment} · ${money(c.fee)}`}</p>
          <QualChips quals={[c.modality]} />
        </>
      )}{' '}
      {g.state !== 'leaving' && <ChanceLine guest={g} />} <p class="status">{guestStatus(g, sim)}</p>{' '}
      <label title="It worsens while they wait, faster with some conditions. The worse it gets, the less likely their treatment is to work, and if it runs out they go home worse off.">
        Condition
        <Bar value={g.health} class={g.health < POOR_CONDITION ? 'bad' : ''} />
      </label>{' '}
      <label>
        Patience
        <Bar value={g.patience} class={g.patience < 25 ? 'bad' : ''} />
      </label>{' '}
      <label>
        {`Diagnosis (${percent(Math.min(g.diagnosis, 1))} sure, ${percent(sure)} needed)`}
        <Bar value={(g.diagnosis / sure) * 100} class="blue" />
      </label>{' '}
      <label>
        Thirst
        <Bar value={g.thirst} class="need" />
      </label>
      <label>
        Hunger
        <Bar value={g.hunger} class="need" />
      </label>
      <label>
        Bladder
        <Bar value={g.bladder} class="need" />
      </label>{' '}
      <Feelings guest={g} />
      <p class="sub">{`Spent so far: ${money(g.spent)}`}</p>
      <CalmButton guest={g} />
      {g.state !== 'leaving' && (
        <Button
          class="danger sendhome"
          title="They leave without treatment: no fee, and a small knock to your reputation."
          onPress={() => {
            sim.sendHome(g.id);
          }}
        >
          🏠 Send home
        </Button>
      )}
    </>
  );
}
