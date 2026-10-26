// The Plans overlay's key, top right in place of an overlay's scale: every room pencilled in, what building them all
// would cost and how many no longer fit, with a way to go to each or build it, and to hide the plans.

import './PlansKey.css';

import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { planRows, plansLine } from '../lib/sketches';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** The list of sketches while the Plans overlay is on. Building or erasing one leaves the overlay on. */
export function PlansKey() {
  const hud = useHud();
  const { sim, view, tools } = useGame();
  const rows = planRows(sim.world);
  return (
    <div id="plans-key" class="panel">
      <h4>
        <span>✎ Plans</span>
        <span class="pencilled">overlay</span>
      </h4>
      <p class="sub">{plansLine(sim.world)}</p>
      {rows.length > 0 && (
        <ul>
          {rows.map((r) => (
            <li key={r.id} data-sketch={r.id}>
              <Icon id={r.icon} size={20} />
              <span class="what">
                <b>{r.name}</b>
                <small>{r.sub}</small>
              </span>
              <span class={cx('fit', r.standing === 'fits' && 'ok', r.unfit && 'unfit')}>{r.chip}</span>
              <span class="price">{r.price}</span>
              <Button
                class="go"
                title="Take the camera there"
                onPress={() => {
                  const sk = sim.sketch(r.id);
                  if (sk) view.lookAt(sk.x + sk.w / 2, sk.y + sk.h / 2);
                }}
              >
                Go
              </Button>
              <Button
                class="build"
                title="Build here, as its panel does"
                onPress={() => {
                  tools.buildSketch(r.id);
                }}
              >
                Build
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        class="hide"
        onPress={() => {
          hud.overlay = null;
        }}
      >
        Hide plans
      </Button>
    </div>
  );
}
