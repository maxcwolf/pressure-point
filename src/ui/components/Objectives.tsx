// Top left: the objectives for the next star, the tutorial's steps or what a first game will need soon, and the
// emergency in progress.

import { useState } from 'preact/hooks';

import { centerOf, conditionOf, type GoalSpec, MODALITIES } from '../../core/data';
import { money } from '../../core/format';
import type { Objective } from '../../core/sim/goals';
import type { TutorialLine } from '../../core/sim/tutorial';
import { css } from '../../styled-system/css';
import { panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { wholeDaysLeft } from '../lib/emergency';
import { readyLines } from '../lib/waves';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { StarRow } from './common/Stars';

/** Top left, narrower in a narrow window. */
const panel = css({ top: 'gutter', left: 'gutter', w: 'panel.objectives', _max720: { w: 'panel.objectives-narrow' } });

/** The center's name, in small teal capitals over the heading. */
const centerName = css({
  fontSize: '12',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  color: 'fg.accent',
});

/** The stars earned and to come, gold outlined in navy. */
const stars = css({
  color: 'star',
  fontSize: '24',
  letterSpacing: 'stars',
  WebkitTextStroke: '[{borderWidths.fine} {colors.outline}]',
  paintOrder: 'stroke fill',
});

/** A list of objectives or steps. */
const list = css({ listStyle: 'none', p: '0', mt: '4' });

/** A line with a tick or a circle before it and its words after, taking the room left; green once done. */
const tickLine = css.raw({ display: 'flex', gap: '6', '& span': { flex: '1' }, '&.done': { color: 'good.strong' } });

/** An objective, or the line saying there are none left. */
const objectiveLine = css(tickLine, { fontSize: '14', py: '4' });

/**
 * One of the things a first game will need soon, or one of the tutorial's steps: the one in hand in bold, those to come
 * grey.
 */
const stepLine = css(tickLine, {
  fontSize: '13',
  py: '2',
  '&.current': { fontWeight: 'bold' },
  '&.ahead': { color: 'fg.muted' },
});

/** Words that open something out when clicked, as plain as the words around them, underlined under the pointer. */
const opener = css.raw({
  bg: '[none]',
  border: 'none',
  p: '0',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  _hover: { textDecoration: 'underline' },
});

/** An objective's label, which shows the numbers behind it. */
const objectiveLabel = css(opener);

/** The numbers behind an objective, a line each, on a faint ground. */
const detailList = css({
  listStyle: 'none',
  py: '4',
  px: '8',
  m: '0',
  mt: '4',
  mb: '2',
  bg: 'bg.subtle',
  borderRadius: '8',
  fontSize: '12',
  color: 'fg',
  '& li': { display: 'list-item', listStyle: 'none', py: '1', fontSize: '12' },
});

/** What a first game will need soon, or the tutorial's steps, under a dashed line. */
const gettingReady = css({ mt: '8', pt: '6', borderTop: 'divider.dashed' });

/** Its heading, in small teal capitals. */
const gettingReadyHeading = css({
  m: '0',
  fontSize: '12',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  color: 'fg.accent',
});

/** Opening out the tutorial's steps, or folding them again, in small teal words. */
const moreLabel = css(opener, { fontSize: '12', color: 'fg.accent' });

/**
 * A card for something under way: an emergency or a stress outbreak in red. `emergency`, `outbreak` and `challenge` are
 * for the end-to-end tests to find each by.
 */
const card = css.raw({
  mt: '8',
  py: '6',
  px: '8',
  bg: 'bad.bg',
  border: '[{borderWidths.thin} solid {colors.bad.solid}]',
  borderRadius: '10',
  fontSize: '13',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

/** The card for an emergency or a stress outbreak. */
const emergencyCard = css(card);

/** The card for a staff challenge, in gold. */
const challengeCard = css(card, { bg: 'highlight.bg', borderColor: 'highlight' });

/** The card for an ailment going around, in orange, with a line for each part of getting ready. */
const waveCard = css(card, {
  bg: 'warm.bg',
  borderColor: 'warm.solid',
  '& .ready': { fontSize: '12', m: '0' },
  '& .ready.ok': { color: 'good.strong' },
  '& .ready.warn': { color: 'warn' },
});

/** The wave card's heading and how it stands, which open its dialog again when clicked. */
const waveOpener = css(opener, { display: 'flex', flexDirection: 'column', gap: '2' });

/** One objective: its label and progress, and on a click the numbers behind it, a line each. */
function ObjectiveRow({ objective: o, goal }: { objective: Objective; goal: GoalSpec | undefined }) {
  const { sim } = useGame();
  const [open, setOpen] = useState(false);
  const detail = open && goal ? sim.objectiveDetail(goal) : null;
  return (
    <li class={cx(objectiveLine, o.done && 'done', open && 'open')}>
      <b>{o.done ? '✔' : '○'}</b>
      <span>
        <Button
          class={objectiveLabel}
          title={open ? 'Hide the numbers behind this objective' : 'Show the numbers behind this objective'}
          onPress={() => {
            setOpen(!open);
          }}
        >
          {o.label}
        </Button>
        <Bar value={o.progress * 100} class="thin" />
        {detail && (
          <ul class={detailList}>
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
    <div class={cx('challenge', challengeCard)}>
      <b>
        <IconText id="ui-target">{`${ch.staffName}'s challenge`}</IconText>
      </b>{' '}
      <span>{`${o.label} · ${wholeDaysLeft(ch.deadline - sim.s.day)} days left · ${money(ch.reward)}`}</span>
      <Bar value={o.progress * 100} class="thin gold" />
    </div>
  );
}

/**
 * The ailment going around, if any: before its guests come, how soon, and a line for each part of getting ready for
 * its treatment; while they come, the days left and how they have fared.
 */
function WaveCard() {
  const hud = useHud();
  const { sim } = hud.host;
  const s = sim.s;
  const w = s.wave;
  if (!w || !sim.featureOn('waves')) return null;
  const c = conditionOf(w.condition);
  const m = MODALITIES[c.modality];
  const lines = readyLines(s, m.id, sim.waveChecks(m.id));
  const before = s.day < w.starts;
  // the wave's guests in the center now, being seen or waiting
  const here = s.guests.filter((g) => g.wave && g.state !== 'leaving').length;
  return (
    <div class={cx('wave', waveCard)}>
      <Button
        class={waveOpener}
        title="What is going around, and what getting ready takes"
        onPress={() => {
          hud.open('wave');
        }}
      >
        <b>
          <IconText id="bubble-sick">{`Going around: ${c.name}`}</IconText>
        </b>
        <span>
          {before
            ? `In ${wholeDaysLeft(w.starts - s.day)} days · for ${Math.round(w.ends - w.starts)} days`
            : `${wholeDaysLeft(w.ends - s.day)} days left · ${here} in now · ${w.healed} healed${w.turned ? ` · ${w.turned} came back later` : ''}`}
        </span>
      </Button>
      {lines.map(({ ok, text }) => (
        <p key={text} class={cx('ready', ok ? 'ok' : 'warn')}>
          {`${ok ? '✔' : '⚠'} ${text}`}
        </p>
      ))}
    </div>
  );
}

/** The stress outbreak in progress, if any: calming sessions left, carriers lost so far, and the days left. */
function OutbreakCard() {
  const { sim } = useGame();
  const o = sim.s.outbreak;
  if (!o) return null;
  return (
    <div class={cx('emergency', 'outbreak', emergencyCard)}>
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
    <div class={gettingReady}>
      <h4 class={gettingReadyHeading}>Getting ready</h4>
      <ul class={list}>
        {lines.map((l) => (
          <li key={l.id} class={cx(stepLine, l.done && 'done')}>
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
 * While the tutorial is on, its steps: those done ticked, the one in hand in bold and the rest grey. Folded, the count
 * done in the heading stands for those done, under it the one in hand and the next couple; a click opens it all out,
 * and another folds it again.
 */
function TutorialList() {
  const { sim } = useGame();
  const [open, setOpen] = useState(false);
  const lines = sim.tutorialLines();
  if (!lines.length) return null;
  const done = lines.filter((l) => l.done).length;
  // the steps to come after the one in hand, or after the last done while none is
  const at = lines.findIndex((l) => l.current);
  const ahead = lines.filter((l, i) => !l.done && !l.current && i > at).slice(0, STEPS_AHEAD);
  /** Whether a line shows while the list is folded. */
  const folded = (l: TutorialLine) => l.current || ahead.includes(l);
  const shown = open ? lines : lines.filter(folded);
  const more = lines.length - lines.filter(folded).length;
  return (
    <div class={gettingReady}>
      <h4 class={gettingReadyHeading}>{`Tutorial · ${done} of ${lines.length} done`}</h4>
      <ul class={list}>
        {shown.map((l) => (
          <li
            key={l.id}
            class={cx(stepLine, l.done && 'done', l.current && 'current', !l.done && !l.current && 'ahead')}
          >
            <b>{l.done ? '✔' : '○'}</b>
            <span>{l.label}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Button
          class={moreLabel}
          onPress={() => {
            setOpen(!open);
          }}
        >
          {open ? 'Fewer' : `${more} more`}
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
    <div id="objectives" class={cx(panelCard(), panel)}>
      {s.center !== 'sandbox' && <p class={centerName}>{centerOf(s).name}</p>}
      <h3>{goals[s.stars] ? `Star ${s.stars + 1} objectives` : 'All stars earned!'}</h3>
      <div class={stars}>
        <StarRow earned={s.stars} of={goals.length} />
      </div>
      <ul class={list}>
        {objectives.length ? (
          objectives.map((o, i) => <ObjectiveRow key={o.label} objective={o} goal={goals[s.stars]?.[i]} />)
        ) : (
          <li class={cx(objectiveLine, 'done')}>
            <b>✔</b>
            <span>Nothing left to prove. For now.</span>
          </li>
        )}
      </ul>
      {s.tutorial ? <TutorialList /> : <GettingReady />}
      <ChallengeCard />
      <OutbreakCard />
      <WaveCard />
      {emergency && (
        <div class={cx('emergency', emergencyCard)}>
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
