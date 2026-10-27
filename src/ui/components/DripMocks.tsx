/* eslint-disable -- pictures only, to be dropped: see the comment below */
// Pictures only: mockups of the research-drip options (docs/planning/fun/options/research-drip/), drawn into the real
// panels so the pictures look like the game. Each shows only while `window.ppMock` names it, set from the console.
// Not for merging: this file and the lines that call it go in a commit of their own, to be dropped.

import type { Discipline, Modality } from '../../core/data';
import { css } from '../../styled-system/css';
import { buttonRow, goButton } from '../../styled-system/recipes';
import { cx } from '../lib/cx';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { Dialog } from './dialogs/Dialog';
import { ledgerLook } from './menus/looks';

export type DripMock = 'research' | 'research-late' | 'trend' | 'trend-late' | 'catalog' | 'ladder';

/** The mockup the console asked for, if any. */
export const dripMock = (): DripMock | undefined => (globalThis as { ppMock?: DripMock }).ppMock;

/** A card in the objectives panel, as the challenge and emergency cards are drawn. */
const objCard = css({
  mt: '8',
  py: '6',
  px: '8',
  borderRadius: '10',
  fontSize: '13',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  border: '[{borderWidths.thin} solid {colors.special.solid}]',
  bg: 'special.bg',
  '&.trend': { bg: 'warm.bg', borderColor: 'warm.solid' },
  '& .sub': { fontSize: '12', m: '0', color: 'fg.muted' },
  '& .ready': { fontSize: '12', m: '0' },
  '& .ready.warn': { color: 'warn' },
  '& .ready.ok': { color: 'good.strong' },
});

/** The research under way or the ailment going around, under the objectives. */
export function DripObjectiveCard() {
  const mock = dripMock();
  if (mock === 'research-late')
    return (
      <div class={objCard}>
        <b>
          <IconText id="bubble-idea">Research: Gong Bath, refined</IconText>
        </b>
        <span>Yuki Tanaka at the Research Desk · 26 of 35 days</span>
        <Bar value={74} class="thin" />
        <p class="sub">Next: Moxibustion, refined ($24,000)</p>
      </div>
    );
  if (mock === 'trend')
    return (
      <div class={cx('trend', objCard)}>
        <b>
          <IconText id="bubble-sick">Going around: Cold Feet</IconText>
        </b>
        <span>In 7 days · for 30 days</span>
        <p class="ready ok">✔ Moxibustion opens now</p>
        <p class="ready warn">⚠ Nobody trained in it</p>
        <p class="ready warn">⚠ One table: expect a line</p>
      </div>
    );
  if (mock === 'trend-late')
    return (
      <div class={cx('trend', objCard)}>
        <b>
          <IconText id="bubble-sick">Going around: Sea Legs</IconText>
        </b>
        <span>From The Boardwalk · in 6 days · for 30 days</span>
        <p class="ready ok">✔ Classic Needling treats it</p>
        <p class="ready warn">⚠ Two Acupuncturists: expect a line</p>
      </div>
    );
  return null;
}

/** The Research Desk's strip over the Treatments menu: who is at it, the study under way, and the ones lined up. */
const researchStrip = css(ledgerLook, {
  mb: '10',
  borderColor: 'special.solid',
  bg: 'special.bg',
  '& h4': { m: '0' },
  '& .sub': { m: '0 !important', mt: '2 !important' },
  '& .queue': { display: 'flex', gap: '6', flexWrap: 'wrap', mt: '6' },
  '& .queue em': {
    fontStyle: 'normal',
    fontSize: '12',
    bg: 'bg.card',
    border: '[{borderWidths.thin} solid {colors.special.solid}]',
    borderRadius: '8',
    py: '2',
    px: '6',
  },
});

/** Over the Treatments menu: the Research Desk and its queue. */
export function DripTreatmentsHeader() {
  if (dripMock() !== 'research') return null;
  return (
    <div class={researchStrip}>
      <h4>
        <IconText id="bubble-idea">Research Desk · Mei Chen, Senior Acupuncturist</IconText>
      </h4>
      <p class="sub">
        Studying Moxibustion: 18 of 30 days. A study moves on each day someone of its discipline sits at the desk.
      </p>
      <Bar value={60} class="thin" />
      <div class="queue">
        <em>Next: Acupuncture Table, level 2 · $4,000 · 20 days</em>
        <em>Then: Electroacupuncture · $8,000 · 35 days</em>
      </div>
    </div>
  );
}

/** What a locked card says in place of "Unlocks at star n", under a mockup; undefined to leave it as it is. */
export function dripLocked(modality: Modality): preact.ComponentChildren | undefined {
  const mock = dripMock();
  if (mock === 'research') {
    if (modality === 'moxa')
      return (
        <>
          <em class="ok">
            <IconText id="bubble-idea">Researching · 12 days left</IconText>
          </em>
          <Bar value={60} class="thin" />
        </>
      );
    const research: Partial<Record<Modality, string>> = {
      electro: 'Research it: $8,000 · 35 days',
      stone: 'Research it: $7,000 · 30 days',
      cranio: 'Research it: $9,000 · 40 days',
    };
    const line = research[modality];
    if (!line) return undefined;
    return (
      <>
        <em>
          <IconText id="ui-lock">Unlocks at star 2</IconText>
        </em>
        <Button class={researchButton} quiet onPress={() => undefined}>
          <IconText id="bubble-idea">{line}</IconText>
        </Button>
      </>
    );
  }
  if (mock === 'ladder') {
    const rungs: Partial<Record<Modality, string>> = {
      moxa: 'Opens at 25 acupuncture heals (19/25)',
      electro: 'Opens at 50 acupuncture heals (19/50)',
      stone: 'Opens at 60 massage heals (52/60)',
      cranio: 'Opens at 90 massage heals (52/90)',
    };
    const line = rungs[modality];
    return line ? (
      <em>
        <IconText id="ui-lock">{line}</IconText>
      </em>
    ) : undefined;
  }
  return undefined;
}

/** The button to research a locked technique, in lilac. */
const researchButton = css({
  border: 'outline',
  borderRadius: '12',
  py: '4',
  px: '8',
  fontWeight: 'bold',
  fontSize: '12',
  bg: 'special.bg',
  boxShadow: 'low',
  alignSelf: 'flex-start',
  mt: '4',
});

/** A discipline's ladder: its heals so far, and what each rung opens. */
const ladder = css({
  display: 'flex',
  alignItems: 'center',
  gap: '[0]',
  mb: '10',
  mt: '2',
  '& .rung': {
    flex: '1',
    position: 'relative',
    fontSize: '11',
    textAlign: 'center',
    pt: '[22px]',
    color: 'fg.muted',
  },
  '& .rung::before': {
    content: '""',
    position: 'absolute',
    top: '[8px]',
    left: '[0]',
    right: '[0]',
    h: '[6px]',
    bg: 'meter.track',
  },
  '& .rung.done::before': { bg: 'special.solid' },
  '& .rung.part::before': {
    background: '[linear-gradient(90deg, {colors.special.solid} 76%, {colors.meter.track} 76%)]',
  },
  '& .rung::after': {
    content: 'attr(data-n)',
    position: 'absolute',
    top: '[0]',
    right: '[-11px]',
    w: '[22px]',
    h: '[22px]',
    borderRadius: '[50%]',
    bg: 'bg.card',
    border: 'outline',
    fontSize: '[10px]',
    fontWeight: 'bold',
    lineHeight: '[19px]',
    color: 'fg',
    zIndex: '[1]',
  },
  '& .rung.done::after': { bg: 'special.solid', color: 'fg.on-accent' },
  '& .rung b': { display: 'block', color: 'fg', fontSize: '11' },
});

const LADDERS: Partial<Record<Discipline, { heals: number; rungs: [number, string][] }>> = {
  massage: {
    heals: 52,
    rungs: [
      [10, 'Deep Tissue'],
      [25, 'Sports'],
      [40, 'Table level 2'],
      [60, 'Hot Stone'],
      [90, 'Cranio-sacral'],
      [140, 'Table level 3'],
    ],
  },
  acupuncture: {
    heals: 19,
    rungs: [
      [5, 'Classic Needling'],
      [12, 'Cupping'],
      [25, 'Moxibustion'],
      [50, 'Electro'],
      [80, 'Pin Press'],
      [120, 'Table level 3'],
    ],
  },
};

/** Under a discipline's heading, its ladder of heals. */
export function DripLadder({ discipline }: { discipline: Discipline }) {
  const l = dripMock() === 'ladder' ? LADDERS[discipline] : undefined;
  if (!l) return null;
  let prev = 0;
  return (
    <div class={ladder}>
      {l.rungs.map(([n, what]) => {
        const done = l.heals >= n;
        const part = !done && l.heals > prev;
        prev = n;
        return (
          <div key={n} class={cx('rung', done && 'done', part && 'part')} data-n={n}>
            <b>{what}</b>
            {done ? 'open' : `${n} heals`}
          </div>
        );
      })}
    </div>
  );
}

/** What the upgrade button says on a locked level, under the research mockup; undefined to leave it. */
export function dripUpgradeLocked(next: number): string | undefined {
  return dripMock() === 'research' ? `Research level ${next}: $4,000 · 20 days at the desk` : undefined;
}

/** The fanfare when an ailment starts going around: the star dialog's look, a week's warning, and what it opens. */
const lilac = css({
  bg: 'special.bg',
  border: '[{borderWidths.thin} solid {colors.special.solid}]',
  borderRadius: '12',
  py: '8',
  px: '12',
  mt: '10',
  fontSize: '14 !important',
});
const warmCard = css({
  bg: 'warm.bg',
  border: '[{borderWidths.thin} solid {colors.warm.solid}]',
  borderRadius: '12',
  py: '8',
  px: '12',
  mt: '10',
  fontSize: '14 !important',
});
const headline = css({
  fontSize: '12',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 'wider',
  color: 'fg.accent',
  m: '0',
});

export function TrendDialog() {
  return (
    <Dialog>
      <p class={headline}>Going around town</p>
      <h2>
        <IconText id="bubble-sick">Cold Feet</IconText>
      </h2>
      <p>
        <i>“Got them before a big decision. Never got rid of them.”</i> The trading floor’s bonuses were announced, then
        postponed, and half of Mercer Street has them.
      </p>
      <p class={warmCard}>
        <b>From day 307, for 30 days:</b> about a quarter of new guests. They pay 25% more while it lasts.
      </p>
      <p class={lilac}>
        <b>New treatment, ahead of star 2:</b> Moxibustion. Train an Acupuncturist in a Training Room; the Moxa Burner
        is in the Items menu.
      </p>
      <p class="sub">Not ready in time? They are told at Reception to come back later. Nothing is lost.</p>
      <div class={buttonRow()}>
        <Button quiet onPress={() => undefined}>
          Treatments menu
        </Button>
        <Button class={goButton()} onPress={() => undefined}>
          Got it
        </Button>
      </div>
    </Dialog>
  );
}

/** The catalog's offers, as the Money menu's white cards. */
const offers = css({
  display: 'grid',
  gridTemplateColumns: '[repeat(2, 1fr)]',
  gap: '10',
  mt: '10',
});
const offer = css(ledgerLook, {
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  '& h4': { m: '0' },
  '& .sub': { m: '0 !important' },
  '& .tag': {
    alignSelf: 'flex-start',
    fontSize: '11',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 'wider',
    color: 'special',
  },
  '& .price': { fontWeight: 'bold', fontSize: '14' },
});
const masthead = css(ledgerLook, {
  borderColor: 'highlight',
  bg: 'highlight.bg',
  '& h4': { m: '0' },
  '& .sub': { m: '0 !important', mt: '2 !important' },
});

const OFFERS: { tag: string; name: string; text: string; price: string; buy: string }[] = [
  {
    tag: 'Collector’s piece',
    name: 'The Founder’s Gong',
    text: 'Struck once, at the opening of a center that later closed. +2 prestige in a Sound Bath Studio, and 10% calmer.',
    price: '$48,000 · one in stock',
    buy: 'Order',
  },
  {
    tag: 'Upgrade kit',
    name: 'Table level 4: Heated Face Hole',
    text: 'For every Massage Table here. Wears 20% more slowly, and guests forgive a longer wait.',
    price: '$36,000 · fitted by a Mechanic',
    buy: 'Order',
  },
  {
    tag: 'This month only',
    name: 'Himalayan Salt Wall',
    text: 'A whole wall of salt, lit from behind. Prestige 3. The vendor would not say which Himalaya.',
    price: '$22,000',
    buy: 'Order',
  },
  {
    tag: 'Clearance',
    name: 'Last season’s Aura Camera',
    text: 'Takes a photo of a guest’s aura for $40. The auras are all slightly purple.',
    price: '$9,500 · was $14,000',
    buy: 'Order',
  },
];

/** The Money menu's Catalog tab: this month's issue and its four offers. */
export function CatalogTab() {
  return (
    <>
      <div class={masthead}>
        <h4>
          <IconText id="ui-news">Wellness Wholesale · Harvest issue</IconText>
        </h4>
        <p class="sub">Four offers, good until the end of the month. Delivered to the curb in 3 days.</p>
      </div>
      <div class={offers}>
        {OFFERS.map((o) => (
          <div key={o.name} class={offer}>
            <span class="tag">{o.tag}</span>
            <h4>{o.name}</h4>
            <p class="sub">{o.text}</p>
            <span class="price">{o.price}</span>
            <div class={buttonRow({ align: 'left' })}>
              <Button quiet onPress={() => undefined}>
                <IconText id="ui-items">{o.buy}</IconText>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
