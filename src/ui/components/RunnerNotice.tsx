// Top center, with the offers: a pill for each guest on a really bad trip, with the time left before they find the
// door, that takes the player to them, and a button to send someone after them.

import { DAY_SECONDS } from '../../core/data';
import type { Guest } from '../../core/state/types';
import { css } from '../../styled-system/css';
import { buttonRow, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { calmingNote, doorShare, NOBODY_FREE, runnerLine, runnersShown, sendLabel, sendTitle } from '../lib/calming';
import { cx } from '../lib/cx';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/**
 * A runner's pill: a panel in pink, popping in, with their name and the time left over a bar, and who to send under
 * them. `runner-pill` is for the end-to-end tests to find it by.
 */
const pill = css({
  display: 'block',
  my: '0',
  mx: '[auto]',
  borderColor: 'notice.runner',
  p: '12',
  pt: '6',
  pb: '8',
  font: 'inherit',
  fontSize: '14',
  fontWeight: 'bold',
  textAlign: 'center',
  animation: 'pop 0.2s ease-out',
});

/** Their name and the time left, a click to them, lifting a little under the pointer. */
const show = css({
  display: 'block',
  w: '[100%]',
  border: '[none]',
  bg: '[none]',
  p: '0',
  font: 'inherit',
  _hover: { transform: '[translateY(-1px)]' },
});

/** Who to send, or who is on the way, in a smaller row than usual. */
const buttons = css({ mt: '4', '& button': { fontSize: '14', py: '4', px: '12', mt: '2' } });

/** Who is on the way. */
const onTheWay = css({ fontSize: '13', fontWeight: 'bold', opacity: '[0.85]' });

/** The pills for everyone running round on a really bad trip, newest first. */
export function RunnerNotice() {
  const { sim } = useGame();
  const { shown, more } = runnersShown(sim.s.guests.filter((g) => g.state === 'running'));
  return (
    <>
      {shown.map((g, i) => (
        <RunnerPill key={g.id} guest={g} more={i === shown.length - 1 ? more : 0} />
      ))}
    </>
  );
}

/** One runner's pill: their name and time left, which shows them, and who to send or who is on the way. */
function RunnerPill({ guest: g, more }: { guest: Guest; more: number }) {
  const hud = useHud();
  const { sim, audio } = useGame();
  const left = g.runaway ?? 0;
  const calmer = sim.calmerOf(g);
  const sent = sim.calmerFor(g);
  return (
    <div class={cx(panelCard(), 'runner-pill', pill)}>
      <Button
        class={show}
        title="Show me"
        onPress={() => {
          hud.show({ kind: 'guest', id: g.id });
        }}
      >
        <span>
          <IconText id="feeling-bad-trip">{runnerLine(g.name, left, more)}</IconText>
        </span>
        <Bar value={doorShare(left) * 100} class={left < DAY_SECONDS ? 'thin bad' : 'thin need'} />
      </Button>
      <div class={cx(buttonRow(), buttons)}>
        {calmer ? (
          <span class={onTheWay}>
            <IconText id="bubble-relieved">{calmingNote(calmer.name, calmer.state === 'doingJob')}</IconText>
          </span>
        ) : sim.canCalm(g) && sent ? (
          <Button
            title={sendTitle(sent)}
            onPress={() => {
              if (!sim.calm(g.id)) audio.play('error');
            }}
          >
            <IconText id="bubble-relieved">{sendLabel(sent.name)}</IconText>
          </Button>
        ) : (
          <Button locked title={NOBODY_FREE} onPress={() => undefined}>
            Nobody free to go
          </Button>
        )}
      </div>
    </div>
  );
}
