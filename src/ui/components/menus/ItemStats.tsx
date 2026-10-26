// What an item does, shown three ways in the Items menu: as chips on its card, in its tooltip, or in a panel beside
// the cards, as the settings choose.

import { HEAT_RADIUS, type IconId, ITEMS, type ItemType } from '../../../core/data';
import { money } from '../../../core/format';
import { decorReach } from '../../../core/sim/ambience';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { DECOR_MOST, HEAT_MOST, type ItemStat, itemStats, NOISE_MOST } from '../../lib/item-stats';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';

/** The chips along the bottom of a card, each tinted for what it is: decor, quiet or cool, loud, warm, earning, a seat. */
const chips = css({
  listStyle: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4',
  m: '0',
  mt: '[auto]',
  p: '0',
  pt: '6',
  '& li': {
    fontSize: '12',
    fontWeight: 'medium',
    border: '[{borderWidths.fine} solid {colors.chip.border}]',
    bg: 'chip',
    borderRadius: '8',
    py: '0',
    px: '6',
    whiteSpace: 'nowrap',
  },
  '& .decor': { bg: 'highlight.bg', borderColor: 'highlight' },
  '& :is(.calm, .cool)': { bg: 'info.bg', borderColor: 'info.solid' },
  // a calm chip sits a little lower, as it did when it took the inspector's old global .calm, meant for its calm button
  '& .calm': { display: 'block', mt: '8' },
  '& .loud': { bg: 'bad.bg', borderColor: 'bad.solid', color: 'bad' },
  '& .warm': { bg: 'warm.bg', borderColor: 'warm.solid' },
  '& .earn': { bg: 'good.bg', borderColor: 'good.solid', color: 'good' },
  '& .seat': { bg: 'special.bg', borderColor: 'special.solid' },
});

/** A row of pips, faint on the tooltip's navy, the ones filled in the color of what they count. */
const pips = css({
  display: 'flex',
  gap: '2',
  m: '0',
  mt: '2',
  mb: '[1px]',
  '& i': { w: '[10px]', h: '[10px]', borderRadius: '2', bg: 'bg.inverse-subtle' },
  '&.decor i.on': { bg: 'highlight' },
  '&.calm i.on': { bg: 'info.light' },
  '&.loud i.on': { bg: 'bad.bright' },
});

/** The tooltip's list of what an item does, a line each, with its icon beside it. */
const tip = css({
  '& ul': { listStyle: 'none', m: '0', mt: '2', p: '0', display: 'flex', flexDirection: 'column', gap: '2' },
  '& li': { display: 'flex', gap: '6', fontSize: '13', lineHeight: 'snug' },
  '& li > .icon': { mt: '[1px]' },
});

/** The panel beside the cards, which stays in view while the cards scroll. */
const detail = css({
  position: 'sticky',
  top: '[0]',
  bg: 'bg.card',
  border: 'outline',
  borderRadius: '14',
  p: '12',
  pt: '10',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  fontSize: '14',
  lineHeight: 'snug',
  '& p': { opacity: 'soft' },
  // a scale's name, with what it comes to at the far end
  '& label': { display: 'flex', justifyContent: 'space-between', fontSize: '12' },
  '& label b': { fontWeight: 'bold' },
  '& em': {
    fontStyle: 'normal',
    fontSize: '12',
    bg: 'bg.inset',
    borderRadius: '8',
    py: '2',
    px: '6',
    alignSelf: 'flex-start',
  },
});

/** The panel's head: the item's icon, its name, and its price in a gold tag. */
const detailHead = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10',
  '& b': { display: 'block', fontSize: '17', fontWeight: 'bold' },
  '& .cost': {
    display: 'inline-block',
    bg: 'highlight',
    border: 'outline.thin',
    borderRadius: '8',
    py: '0',
    px: '6',
    fontSize: '13',
    fontWeight: 'bold',
  },
});

/** What else the item does, a line each. */
const factList = css({
  listStyle: 'none',
  m: '0',
  mt: '2',
  p: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  '& li': { bg: 'chip', borderRadius: '8', py: '2', px: '8', fontSize: '13' },
});

/** The panel's button: green to place the item, grey while it cannot be. */
const place = css({
  mt: '2',
  border: 'outline',
  borderRadius: '12',
  bg: 'go',
  color: 'fg.on-accent',
  fontWeight: 'bold',
  fontSize: '15',
  py: '6',
  px: '12',
  boxShadow: 'low',
  _locked: { bg: 'bg.disabled', color: 'fg', cursor: 'not-allowed' },
});

/**
 * A scale with its middle at nothing: a bar like Bar's, with a line down its middle, filling from there one way or
 * the other, and the two ends named under it. Noise is bad turned up and good turned down; warmth is warm one way and
 * cool the other.
 */
const twoWay = css({
  '& .bar': {
    position: 'relative',
    h: '[10px]',
    borderRadius: '6',
    bg: 'meter.track',
    overflow: 'visible',
    mt: '2',
  },
  '& .bar .mid': {
    position: 'absolute',
    left: '[50%]',
    top: '[-2px]',
    bottom: '[-2px]',
    w: '[2px]',
    ml: '[-1px]',
    bg: 'bg.backdrop',
  },
  '& .bar i': {
    position: 'absolute',
    top: '[0]',
    display: 'block',
    h: '[100%]',
    borderRadius: '6',
    transition: '[width {durations.slow}]',
  },
  '& .bar i.up': { left: '[50%]' },
  '& .bar i.down': { right: '[50%]', bg: 'info.solid' },
  '&.noise .bar i.up': { bg: 'bad.solid' },
  '&.warmth .bar i.up': { bg: 'warm.solid' },
  '& small': {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11',
    opacity: 'quiet',
    mt: '[1px]',
  },
});

/** An item's stats as chips along the bottom of its card. */
export function ItemChips({ type }: { type: ItemType }) {
  const stats = itemStats(type);
  if (!stats.length) return null;
  return (
    // `stat-chips` is for the card, which makes room for them
    <ul class={cx('stat-chips', chips)}>
      {stats.map((s) => (
        <li key={s.id + s.short} class={s.tone}>
          <IconText id={s.icon}>{s.short}</IconText>
        </li>
      ))}
    </ul>
  );
}

/** A row of pips, so many filled out of so many, for how much decor or noise an item has against the most there is. */
function Pips({ value, most, tone }: { value: number; most: number; tone: string }) {
  return (
    <span class={cx(pips, tone)}>
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
    <div class={tip}>
      <strong>
        <IconText id={def.icon}>{def.name}</IconText>
      </strong>
      <ul>
        {itemStats(type).map((s) => (
          <li key={s.id + s.short}>
            <Icon id={s.icon} size={18} />
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
    <div class={cx(twoWay, kind)}>
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
  /** The icon before the label: a lock, or an empty purse. */
  icon?: IconId | undefined;
  /** Why it is refused, if it is. */
  title?: string | undefined;
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
    <div class={detail}>
      <div class={detailHead}>
        <Icon id={def.icon} size={44} />
        <div>
          <b>{def.name}</b>
          <span class="cost">{money(def.cost)}</span>
        </div>
      </div>
      <p>{def.desc}</p>
      <div>
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
        <ul class={factList}>
          {facts.map((s) => (
            <li key={s.id + s.short}>
              <IconText id={s.icon}>{s.long}</IconText>
            </li>
          ))}
        </ul>
      )}
      <em>{where}</em>
      <Button class={place} title={action.title} locked={action.locked} onPress={action.onPress}>
        {action.icon ? <IconText id={action.icon}>{action.label}</IconText> : action.label}
      </Button>
    </div>
  );
}
