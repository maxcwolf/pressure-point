// The looks the menus share: the panel each is drawn on, a title with the Sort by list beside it, rows of cards to
// pick from, the Money menu's white cards, a chart's bars and the Stats menu's tables. A look one of them changes a
// little is a style object as well, for it to pass to css() with its changes, so the two come out as one set of styles.

import { css } from '../../../styled-system/css';

/** The panel a menu is drawn on, which scrolls once it is taller than the room above the bar. */
export const menuPanel = css({
  maxH: '[calc(var(--vh) - var(--bar-h) - 116px)]',
  overflowY: 'auto',
  // smaller words under a heading keep a little more room around them in a menu
  '& .sub': { m: '[7px 0 9px]' },
});

/** A menu's title, with the Sort by list for what it lists at the far end. */
export const menuHead = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  rowGap: 's',
  columnGap: 'l',
  mb: 's',
  '& h3': { mb: 'none' },
});

/** A menu's row of tabs, or of filters over a list, a little apart from what comes under it. */
export const tabRow = css({ mb: 'm' });

/**
 * A row of cards, as many to a line as fit. Ringed by the tutorial, a row shrinks to its cards, so the ring wraps them
 * rather than the panel's whole width, and takes their corners, so the ring rounds with the cards it holds.
 */
export const cardsLook = css.raw({
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fill, minmax(172px, 1fr))]',
  gap: '[9px]',
  '&.guide': { display: 'flex', flexWrap: 'wrap', w: '[fit-content]', maxW: '[100%]', borderRadius: '[14px]' },
  '&.guide > .card': { flex: '[0 0 172px]' },
});

/** A row of cards. */
export const cards = css(cardsLook);

/**
 * A card to pick from a menu: an icon, a name, its price in a gold tag at the top right, a line or two about it, and
 * a tag along the bottom. One that can be pressed lifts under the pointer. Cards keep the class `card` as well, for the
 * rows that lay them out and for the end-to-end tests.
 */
export const cardLook = css.raw({
  position: 'relative',
  textAlign: 'left',
  bg: 'white',
  border: '[2.5px solid {colors.navy}]',
  borderRadius: '[14px]',
  p: '[9px 10px 9px]',
  display: 'flex',
  flexDirection: 'column',
  gap: 'xxs',
  transition: '[transform 0.08s]',
  '&:is(button):hover': { transform: 'translateY(-3px)', bg: '[#f0fbf9]', borderColor: 'teal-dark' },
  '& > .icon': { mb: 'xxs' },
  '& b': { fontSize: '[15px]', fontWeight: 'bold' },
  '& p': { fontSize: '[12px]', lineHeight: '[1.25]', opacity: '[0.8]' },
  '& em': {
    fontStyle: 'normal',
    fontSize: '[11.5px]',
    bg: 'sand',
    borderRadius: '[8px]',
    p: '[2px 7px]',
    alignSelf: 'flex-start',
    mt: '[3px]',
  },
  '& em.none': { opacity: '[0.6]' },
  // an applicant's quirk: green where it helps, red where it costs
  '& em.good': { bg: '[#dff3e4]', color: '[#1d6a45]' },
  '& em.bad': { bg: 'bad-bg', color: 'bad' },
  // how much more an item needs before it can be bought
  '& em.short': { bg: 'bad-bg', color: 'bad', fontWeight: 'bold' },
  '& .cost': {
    position: 'absolute',
    top: 'm',
    right: '[9px]',
    bg: 'gold',
    border: 'control',
    borderRadius: 'control',
    p: '[0 7px]',
    fontSize: '[13px]',
    fontWeight: 'bold',
  },
  '&.poor': { opacity: '[0.6]', cursor: 'not-allowed' },
  '&.poor .cost': { bg: '[#f3b1ac]' },
  _locked: { opacity: '[0.5]', filter: '[grayscale(0.6)]', cursor: 'not-allowed' },
  // short of money rather than locked: the red of the price and the shortfall stay to see
  '&.poor.locked': { opacity: '[0.6]', filter: 'none' },
  // locked, but karma unlocks it: pressing opens the offer
  '&.locked.karma': { cursor: 'pointer' },
});

/** A card to pick from a menu. */
export const card = css(cardLook);

/**
 * One of the Money menu's white cards, such as a month's books: a heading, and lines with their names at one end and
 * their amounts at the other, down to a total under a rule. A row of buttons in one keeps to the left, as rows of
 * buttons do.
 */
export const ledgerLook = css.raw({
  bg: 'white',
  border: 'card',
  borderRadius: 'card',
  py: 'm',
  px: '[11px]',
  fontSize: 'body',
  '& h4': { fontWeight: 'bold', mb: 'xs' },
  '& div': { display: 'flex', p: '[1.5px 0]' },
  '& div:not(.btnrow)': { justifyContent: 'space-between' },
  '& .total': { borderTop: '[2px solid rgba(36, 56, 74, 0.2)]', mt: 'xs', pt: 'xs', fontWeight: 'bold' },
});

/** One of the Money menu's white cards. */
export const ledgerCard = css(ledgerLook);

/** Two of them side by side. */
export const ledgers = css({ display: 'grid', gridTemplateColumns: '[1fr 1fr]', gap: 'l' });

/** A bar chart, a bar a month along the bottom: green for a month that came out ahead, red for one that did not. */
export const chartLook = css.raw({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '[5px]',
  h: '[60px]',
  mt: 'l',
  '& i': { flex: '1', maxW: '[34px]', bg: 'green', borderRadius: '[5px 5px 0 0]' },
  '& i.neg': { bg: 'red' },
});

/** A bar chart. */
export const chart = css(chartLook);

/** A Stats tab's opening words, with its buttons or its Sort by list at the far end. */
export const statsHead = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'l',
  '& :is(.btnrow, .choose)': { mt: 'none' },
});

/** A table of figures, a row each: its name on the left, and the numbers lined up on the right. */
export const tableLook = css.raw({
  w: '[100%]',
  borderCollapse: 'collapse',
  fontSize: '[13px]',
  '& th': {
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: '[12px]',
    p: '[4px 6px]',
    borderBottom: '[2px solid rgba(36, 56, 74, 0.2)]',
  },
  '& td': { textAlign: 'right', p: '[3px 6px]', borderBottom: '[1px solid rgba(36, 56, 74, 0.1)]' },
  '& :is(th, td):first-child': { textAlign: 'left' },
  '& .poor': { color: 'bad', fontWeight: 'bold' },
});

/** A table of figures. */
export const table = css(tableLook);
