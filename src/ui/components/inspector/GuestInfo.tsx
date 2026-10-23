// The inspector for a guest.

import {
  CLASS_FEE,
  conditionOf,
  FEELINGS,
  GUESS_PENALTY,
  MODALITIES,
  SCAN_SUCCESS,
  WEEKDAYS,
} from '../../../core/data';
import { money } from '../../../core/format';
import { weekday } from '../../../core/sim/classes';
import { regularOf } from '../../../core/sim/regulars';
import { guestFee } from '../../../core/sim/stations';
import { upgradeSuccess } from '../../../core/sim/upgrades';
import type { Guest } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { calmingNote, NOBODY_FREE, sendLabel, sendTitle } from '../../lib/calming';
import { chanceText, percent, poorChance } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { meterTone } from '../../lib/meters';
import { regularTag } from '../../lib/regulars';
import { conditionNote, guestStatus, statusClass } from '../../lib/status';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
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

/** How long a waiting guest's condition has left, red once it is poor. */
function ConditionLine({ guest: g }: { guest: Guest }) {
  const note = conditionNote(g);
  if (!note) return null;
  return (
    <p class={cx('sub', 'condition', note.poor && 'poor')}>
      <Line line={note} />
    </p>
  );
}

/** For a guest on a really bad trip, someone to send to calm them down, or who is on the way. */
function CalmRunner({ guest: g }: { guest: Guest }) {
  const { sim, audio } = useGame();
  const calmer = sim.calmerOf(g);
  if (calmer)
    return (
      <p class="sub calmed">
        <IconText id="bubble-relieved">{calmingNote(calmer.name, calmer.state === 'doingJob')}</IconText>
      </p>
    );
  const sent = sim.canCalm(g) ? sim.calmerFor(g) : undefined;
  return (
    <Button
      class="go calm"
      locked={!sent}
      title={sent ? sendTitle(sent) : NOBODY_FREE}
      onPress={() => {
        if (!sim.calm(g.id)) audio.play('error');
      }}
    >
      <IconText id="bubble-relieved">{sent ? `${sendLabel(sent.name)} to calm them down` : 'Calm them down'}</IconText>
    </Button>
  );
}

/**
 * During a stress outbreak, a calming session for this guest: wasted on one who was not stressed. A guest on a really
 * bad trip has someone sent to them instead, outbreak or not.
 */
function CalmButton({ guest: g }: { guest: Guest }) {
  const { sim, audio } = useGame();
  if (g.state === 'running') return <CalmRunner guest={g} />;
  const o = sim.s.outbreak;
  if (!o || g.state === 'leaving') return null;
  if (g.calmed)
    return (
      <p class="sub calmed">
        <IconText id="bubble-relieved">Has had a calming session</IconText>
      </p>
    );
  return (
    <Button
      class="go calm"
      locked={o.calms <= 0}
      title="Spot the stressed by their sweating and fidgeting. A session given to a guest who was fine is wasted."
      onPress={() => {
        if (!sim.calm(g.id)) audio.play('error');
      }}
    >
      <IconText id="bubble-relieved">{`Calm them (${o.calms} left)`}</IconText>
    </Button>
  );
}

/** A class-goer: the class they came for, what they are doing, how they are holding up and how they feel. */
function ClassgoerInfo({ guest: g }: { guest: Guest }) {
  const { sim } = useGame();
  return (
    <>
      <h3>{g.name}</h3>
      <p class="tag">
        <IconText id="room-qigong">Class-goer</IconText>
      </p>{' '}
      <p>{`Here for ${WEEKDAYS[weekday(g.classDay)] ?? ''}’s Qi Gong class, at ${money(Math.round(CLASS_FEE * sim.priceFor('qigong')))} a place.`}</p>{' '}
      <p class={statusClass('doing')}>{guestStatus(g, sim)}</p>{' '}
      <label>
        Patience
        <Bar value={g.patience} tone={meterTone('patience', g.patience)} show />
      </label>{' '}
      <Feelings guest={g} />
      <p class="sub">{`Spent so far: ${money(g.spent)}`}</p>
      <CalmButton guest={g} />
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
          <span key={f} class={FEELINGS[f].good ? 'good' : 'bad'}>
            <IconText id={FEELINGS[f].icon}>{FEELINGS[f].text}</IconText>
          </span>
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
  // the condition is a mystery until a consultation has settled it, though a structural one shows that much first
  const known = g.goal === 'treat' || g.goal === 'leave';
  const structural = !known && !!c.structural && g.consults > 0;
  const unscannable = !!c.structural && !g.scanned;
  const regular = regularOf(sim.s, g);
  return (
    <>
      <h3>{g.name}</h3>
      <p class="tag">
        <Line
          line={
            g.emergency
              ? { icon: 'ui-emergency', text: 'Emergency guest' }
              : regular
                ? regularTag(regular)
                : { text: 'Guest' }
          }
        />
      </p>{' '}
      <p>
        <b>{known ? c.name : structural ? 'Something structural' : 'Undiagnosed'}</b>
        <br />
        {known
          ? c.desc
          : structural
            ? 'The Consultant can see it is in the spine or the joints, but only a posture scan will say just what.'
            : 'Something is clearly wrong. A consultation will reveal what.'}
      </p>{' '}
      {known && (
        <>
          <p class="sub">{`Treatment: ${c.treatment} · ${money(guestFee(sim.s, g))}`}</p>
          <QualChips quals={[c.modality]} />
        </>
      )}{' '}
      {g.state !== 'leaving' && <ChanceLine guest={g} />}{' '}
      {g.scanned && (
        <p class="sub scanned">
          <IconText id="item-posture-scanner">{`Scanned: ${percent(SCAN_SUCCESS + upgradeSuccess(g.scanLevel ?? 0))} more chance of success`}</IconText>
        </p>
      )}{' '}
      {g.guessed && (
        <p class="sub guessed poor">
          <IconText id="ui-warning">{`Best guess, not scanned: ${percent(GUESS_PENALTY)} less chance of success`}</IconText>
        </p>
      )}{' '}
      <p class={statusClass('doing')}>{guestStatus(g, sim)}</p>{' '}
      <label title="It worsens while they wait, faster with some conditions. The worse it gets, the less likely their treatment is to work, and if it runs out they go home worse off.">
        Condition
        <Bar value={g.health} tone={meterTone('condition', g.health)} show />
      </label>{' '}
      <ConditionLine guest={g} />{' '}
      <label>
        Patience
        <Bar value={g.patience} tone={meterTone('patience', g.patience)} show />
      </label>{' '}
      <label>
        {unscannable && g.consults > 0
          ? `Diagnosis (${percent(Math.min(g.diagnosis, 1))} sure, only a scan makes it surer)`
          : `Diagnosis (${percent(Math.min(g.diagnosis, 1))} sure, ${percent(sure)} needed)`}
        <Bar value={(g.diagnosis / sure) * 100} tone="blue" />
      </label>{' '}
      <label>
        Thirst
        <Bar value={g.thirst} tone={meterTone('need', g.thirst)} show />
      </label>
      <label>
        Hunger
        <Bar value={g.hunger} tone={meterTone('need', g.hunger)} show />
      </label>
      <label>
        Bladder
        <Bar value={g.bladder} tone={meterTone('need', g.bladder)} show />
      </label>{' '}
      <Feelings guest={g} />
      <p class="sub">{`Spent so far: ${money(g.spent)}`}</p>
      <CalmButton guest={g} />
      {g.state !== 'leaving' && g.state !== 'running' && (
        <Button
          class="danger sendhome"
          title="They leave without treatment: no fee, and a small knock to your reputation."
          onPress={() => {
            sim.sendHome(g.id);
          }}
        >
          <IconText id="bubble-going-home">Send home</IconText>
        </Button>
      )}
    </>
  );
}
