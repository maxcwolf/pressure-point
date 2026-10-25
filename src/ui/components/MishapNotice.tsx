// Top center, with the offers: a mishap coming, with what it will do and a button to prepare for it, or one under way.

import { ITEMS, MISHAPS } from '../../core/data';
import { money } from '../../core/format';
import { mishapDaysLeft, mishapHolder } from '../../core/sim/mishaps';
import { css } from '../../styled-system/css';
import { buttonRow, goButton, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { mishapLine, noticeShare, preparedNote, startsIn } from '../lib/mishaps';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/**
 * A mishap's panel, in amber, tinted while it is under way; it takes the look of an offer from the column it is in
 * (EmergencyOffer.tsx). `mishap` and `mishap-pill` are for the end-to-end tests to find them by.
 */
const mishapColor = css({ borderColor: '[#d08a2c]', _on: { bg: '[#fff1dc]' } });

/** The mishap coming or under way: in full with Prepare while undecided, otherwise a line with its countdown. */
export function MishapNotice() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const m = s.mishap;
  if (!m) return null;
  const def = MISHAPS[m.kind];
  const left = mishapDaysLeft(s);
  // a generator of the center's own, standing and unbroken, sees it off without preparing
  const held = mishapHolder(s);
  const holder = held && ITEMS[held.type].name;
  if (m.started)
    return (
      <div class={cx(panelCard(), 'offer-pill', 'mishap-pill', 'on', mishapColor)}>
        <span>
          <IconText id={def.icon}>{mishapLine(def, m, left, holder)}</IconText>
        </span>
      </div>
    );
  const timer = <Bar value={noticeShare(left) * 100} class={left < 1 ? 'thin bad' : 'thin need'} />;
  if (m.prepared || holder || m.ward || hud.mishapAside === m.starts)
    return (
      <Button
        class={cx(panelCard(), 'offer-pill', 'mishap-pill', mishapColor)}
        title={
          m.prepared
            ? def.prepare.effect
            : holder
              ? `Your ${holder} will keep it at bay, as long as it does not break down`
              : `Show the ${def.name.toLowerCase()}`
        }
        onPress={() => {
          hud.mishapAside = null;
        }}
      >
        <span>
          <IconText id={def.icon}>{mishapLine(def, m, left, holder)}</IconText>
        </span>
        {timer}
      </Button>
    );
  return (
    <div class={cx(panelCard(), 'offer', 'mishap', mishapColor)}>
      <h3>
        <IconText id={def.icon}>{`${def.name} coming`}</IconText>
      </h3>
      <p>{def.harm}</p>
      <p class="sub">{preparedNote(def)}</p>
      <div class="time-left">
        <span>{startsIn(left)}</span>
        {timer}
      </div>
      <div class={buttonRow()}>
        <Button
          class={goButton()}
          locked={s.money < def.prepare.cost}
          title={s.money < def.prepare.cost ? "You can't afford it" : def.prepare.effect}
          quiet
          onPress={() => {
            sim.prepareMishap();
          }}
        >
          {`${def.prepare.label} (${money(def.prepare.cost)})`}
        </Button>
        {sim.canWard() && (
          <Button
            quiet
            title="A Shaman performs a ward against it. It costs nothing but their time, and holds most of the time."
            onPress={() => {
              sim.askWard();
            }}
          >
            <IconText id="discipline-shaman">Ward it off</IconText>
          </Button>
        )}
        <Button
          onPress={() => {
            hud.mishapAside = m.starts;
          }}
        >
          Take my chances
        </Button>
      </div>
    </div>
  );
}
