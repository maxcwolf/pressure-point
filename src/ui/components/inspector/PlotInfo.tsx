// The inspector for a plot of land the game has bought: its name, which can be changed, how far along the builders
// are, and the rooms built on it once they are done.

import { useState } from 'preact/hooks';

import { ROOMS } from '../../../core/data';
import type { PlotOffer } from '../../../core/land';
import { roomLabels } from '../../../core/sim/assignments';
import { PLOT_NAME_MAX } from '../../../core/sim/land';
import { useGame } from '../../hooks/use-hud';
import { plotSize, roomsOnPlot } from '../../lib/land';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';

/** A bought plot: its name to change, the builders' progress while they are at work, then the rooms on it. */
export function PlotInfo({ offer }: { offer: PlotOffer }) {
  const { sim, tools } = useGame();
  // the name as it is being typed: kept here, or the interface redrawing as the game runs would put the old one back
  const [draft, setDraft] = useState<string | null>(null);
  const { def } = offer;
  const rooms = roomsOnPlot(sim.s.rooms, def);
  const labels = roomLabels(sim.s.rooms);
  return (
    <>
      <h3>
        <input
          class="pname"
          aria-label="Plot name"
          value={draft ?? offer.name}
          maxLength={PLOT_NAME_MAX}
          onInput={(e) => {
            setDraft(e.currentTarget.value);
          }}
          onChange={(e) => {
            sim.renamePlot(def.id, e.currentTarget.value);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </h3>
      <p class="tag">
        <IconText id="ui-expand">{offer.name === def.name ? plotSize(def) : `${def.name} · ${plotSize(def)}`}</IconText>
      </p>
      {offer.state === 'building' ? (
        <>
          <p class="status">
            <IconText id="ui-building">
              {`The builders are at work: done in ${offer.daysLeft} ${offer.daysLeft === 1 ? 'day' : 'days'}`}
            </IconText>
          </p>
          <Bar value={offer.progress * 100} />
          <p class="sub">The building grows into it once they are done.</p>
        </>
      ) : (
        <>
          <h4>Rooms on it</h4>
          {rooms.length ? (
            <ul class="plot-rooms">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Button
                    onPress={() => {
                      tools.select({ kind: 'room', id: r.id });
                    }}
                  >
                    <IconText id={ROOMS[r.type].icon}>{labels.get(r.id) ?? ROOMS[r.type].name}</IconText>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p class="sub">None yet: build one here from the Rooms menu.</p>
          )}
        </>
      )}
    </>
  );
}
