// What an item does, shown three ways in the Items menu: as chips on its card, in its tooltip, or in a panel beside
// the cards, as the settings choose.

import './ItemStats.css';

import { HEAT_RADIUS, ITEMS, type ItemType } from '../../../core/data';
import { money } from '../../../core/format';
import { decorReach } from '../../../core/sim/ambience';
import { DECOR_MOST, HEAT_MOST, type ItemStat, itemStats, NOISE_MOST } from '../../lib/item-stats';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';

/** An item's stats as chips along the bottom of its card. */
export function ItemChips({ type }: { type: ItemType }) {
  const stats = itemStats(type);
  if (!stats.length) return null;
  return (
    <ul class="stat-chips">
      {stats.map((s) => (
        <li key={s.id + s.short} class={s.tone}>{`${s.icon} ${s.short}`}</li>
      ))}
    </ul>
  );
}

/** A row of pips, so many filled out of so many, for how much decor or noise an item has against the most there is. */
function Pips({ value, most, tone }: { value: number; most: number; tone: string }) {
  return (
    <span class={`pips ${tone}`}>
      {Array.from({ length: most }, (_, i) => (
        <i key={i} class={i < value ? 'on' : ''} />
      ))}
    </span>
  );
}

/** How much of a stat an item has, as pips, for the stats that have a scale. */
function scaleOf(type: ItemType, s: ItemStat) {
  const def = ITEMS[type];
  if (s.id === 'decor') return <Pips value={def.decor ?? 0} most={DECOR_MOST} tone="decor" />;
  if (s.id === 'noise') return <Pips value={Math.abs(def.noise ?? 0)} most={NOISE_MOST} tone={s.tone} />;
  return null;
}

/** An item's tooltip: its name and each of its stats in a sentence, with pips for decor and noise. */
export function ItemTip({ type }: { type: ItemType }) {
  const def = ITEMS[type];
  return (
    <div class="item-tip">
      <strong>{`${def.icon} ${def.name}`}</strong>
      <ul>
        {itemStats(type).map((s) => (
          <li key={s.id + s.short}>
            <i>{s.icon}</i>
            <span>
              {s.long}
              {scaleOf(type, s)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A scale with its middle at nothing, filling toward one end or the other: soothing or loud, cooling or warming. */
function TwoWay({
  kind,
  label,
  value,
  most,
  text,
  ends,
}: {
  kind: 'noise' | 'warmth';
  label: string;
  value: number;
  most: number;
  text: string;
  ends: [string, string];
}) {
  const share = (Math.min(Math.abs(value), most) / most) * 50;
  return (
    <div class={`two-way ${kind}`}>
      <label>
        <span>{label}</span>
        <b>{text}</b>
      </label>
      <div class="bar">
        <span class="mid" />
        {value !== 0 && <i class={value > 0 ? 'up' : 'down'} style={{ width: `${share}%` }} />}
      </div>
      <small>
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </small>
    </div>
  );
}

/** What the panel's button does for the item showing: place it, unlock it, or say why it cannot. */
export interface DetailAction {
  label: string;
  locked: boolean;
  onPress: () => void;
}

/** An item in full, beside the cards: its decor, noise and warmth on scales, the rest of what it does, and a button. */
export function ItemDetail({ type, where, action }: { type: ItemType; where: string; action: DetailAction }) {
  const def = ITEMS[type];
  const decor = def.decor ?? 0;
  const noise = def.noise ?? 0;
  const heat = def.heat ?? 0;
  const facts = itemStats(type).filter((s) => s.id !== 'decor' && s.id !== 'noise' && s.id !== 'heat');
  return (
    <div class="item-detail">
      <div class="head">
        <i>{def.icon}</i>
        <div>
          <b>{def.name}</b>
          <span class="cost">{money(def.cost)}</span>
        </div>
      </div>
      <p>{def.desc}</p>
      <div class="one-way">
        <label>
          <span>Decor</span>
          <b>{decor ? `+${decor}, ${decorReach(type)} tiles round` : 'None'}</b>
        </label>
        <Bar value={(decor / DECOR_MOST) * 100} class="gold" />
      </div>
      <TwoWay
        kind="noise"
        label="Noise"
        value={noise}
        most={NOISE_MOST}
        text={noise > 0 ? `Loud ${noise}` : noise < 0 ? `Soothes ${-noise}` : 'Silent'}
        ends={['Soothing', 'Loud']}
      />
      <TwoWay
        kind="warmth"
        label="Warmth"
        value={heat}
        most={HEAT_MOST}
        text={heat ? `${heat > 0 ? '+' : '−'}${Math.abs(heat)}°F, ${def.heatReach ?? HEAT_RADIUS} tiles round` : 'None'}
        ends={['Cools', 'Warms']}
      />
      {facts.length > 0 && (
        <ul class="facts">
          {facts.map((s) => (
            <li key={s.id + s.short}>{`${s.icon} ${s.long}`}</li>
          ))}
        </ul>
      )}
      <em>{where}</em>
      <Button class="place" locked={action.locked} onPress={action.onPress}>
        {action.label}
      </Button>
    </div>
  );
}
