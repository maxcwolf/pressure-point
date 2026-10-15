// Top center, with the offers: a mishap coming, with what it will do and a button to prepare for it, or one under way.

import { MISHAPS } from '../../core/data';
import { money } from '../../core/format';
import { mishapDaysLeft } from '../../core/sim/mishaps';
import { useGame, useHud } from '../hooks/use-hud';
import { mishapLine, noticeShare, preparedNote, startsIn } from '../lib/mishaps';
import { Bar } from './common/Bar';
import { Button } from './common/Button';

/** The mishap coming or under way: in full with Prepare while undecided, otherwise a line with its countdown. */
export function MishapNotice() {
  const hud = useHud();
  const { sim } = useGame();
  const s = sim.s;
  const m = s.mishap;
  if (!m) return null;
  const def = MISHAPS[m.kind];
  const left = mishapDaysLeft(s);
  if (m.started)
    return (
      <div class="panel offer-pill mishap-pill on">
        <span>{mishapLine(def, m, left)}</span>
      </div>
    );
  const timer = <Bar value={noticeShare(left) * 100} class={left < 1 ? 'thin bad' : 'thin need'} />;
  if (m.prepared || m.ward || hud.mishapAside === m.starts)
    return (
      <Button
        class="panel offer-pill mishap-pill"
        title={m.prepared ? def.prepare.effect : `Show the ${def.name.toLowerCase()}`}
        onPress={() => {
          hud.mishapAside = null;
        }}
      >
        <span>{mishapLine(def, m, left)}</span>
        {timer}
      </Button>
    );
  return (
    <div class="panel offer mishap">
      <h3>{`${def.icon} ${def.name} coming`}</h3>
      <p>{def.harm}</p>
      <p class="sub">{preparedNote(def)}</p>
      <div class="time-left">
        <span>{startsIn(left)}</span>
        {timer}
      </div>
      <div class="btnrow">
        <Button
          class="go"
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
            🪶 Ward it off
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
