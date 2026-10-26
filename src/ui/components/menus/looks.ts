// The looks the menus share: the panel each is drawn on, a title with the Sort by list beside it, rows of cards to
// pick from, the Money menu's white cards, a chart's bars and the Stats menu's tables. A look one of them changes a
// little is a style object as well, for it to pass to css() with its changes, so the two come out as one set of styles.

import { css } from '../../../styled-system/css';

/** The panel a menu is drawn on, which scrolls once it is taller than the room above the bar. */
export const menuPanel = css({
  maxH: '[calc(var(--vh) - var(--bar-h) - 116px)]',
  overflowY: 'auto',
  // smaller words under a heading keep a little more room around them in a menu
  '& .sub': { m: '0', mt: '6', mb: '8' },
});

/** A menu's title, with the Sort by list for what it lists at the far end. */
export const menuHead = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  rowGap: '6',
  columnGap: '12',
  mb: '6',
  '& h3': { mb: '0' },
});

/** A menu's row of tabs, or of filters over a list, a little apart from what comes under it. */
export const tabRow = css({ mb: '8' });

/**
 * A row of cards, as many to a line as fit. Ringed by the tutorial, a row shrinks to its cards, so the ring wraps them
 * rather than the panel's whole width, and takes their corners, so the ring rounds with the cards it holds.
 */
export const cardsLook = css.raw({
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fill, minmax(172px, 1fr))]',
  gap: '8',
  '&.guide': { display: 'flex', flexWrap: 'wrap', w: '[fit-content]', maxW: '[100%]', borderRadius: '14' },
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
  bg: 'bg.card',
  border: 'outline',
  borderRadius: '14',
  py: '8',
  px: '10',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  transition: '[transform 0.08s]',
  '&:is(button):hover': { transform: 'translateY(-3px)', bg: 'bg.hover', borderColor: 'accent.strong' },
  '& > .icon': { mb: '2' },
  '& b': { fontSize: '15', fontWeight: 'bold' },
  '& p': { fontSize: '12', lineHeight: 'snug', opacity: 'soft' },
  '& em': {
    fontStyle: 'normal',
    fontSize: '12',
    bg: 'bg.inset',
    borderRadius: '8',
    py: '2',
    px: '6',
    alignSelf: 'flex-start',
    mt: '2',
  },
  '& em.none': { opacity: 'quiet' },
  // an applicant's quirk: green where it helps, red where it costs
  '& em.good': { bg: 'good.bg', color: 'good' },
  '& em.bad': { bg: 'bad.bg', color: 'bad' },
  // how much more an item needs before it can be bought
  '& em.short': { bg: 'bad.bg', color: 'bad', fontWeight: 'bold' },
  '& .cost': {
    position: 'absolute',
    top: '8',
    right: '[9px]',
    bg: 'highlight',
    border: 'outline.thin',
    borderRadius: '8',
    py: '0',
    px: '6',
    fontSize: '13',
    fontWeight: 'bold',
  },
  '&.poor': { opacity: 'quiet', cursor: 'not-allowed' },
  '&.poor .cost': { bg: 'bad.light' },
  _locked: { opacity: 'faint', filter: '[grayscale(0.6)]', cursor: 'not-allowed' },
  // short of money rather than locked: the red of the price and the shortfall stay to see
  '&.poor.locked': { opacity: 'quiet', filter: 'none' },
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
  bg: 'bg.card',
  border: 'card',
  borderRadius: '12',
  py: '8',
  px: '10',
  fontSize: '14',
  '& h4': { fontWeight: 'bold', mb: '4' },
  '& div': { display: 'flex', py: '[1.5px]', px: '0' },
  '& div:not(.btnrow)': { justifyContent: 'space-between' },
  '& .total': { borderTop: 'divider', mt: '4', pt: '4', fontWeight: 'bold' },
});

/** One of the Money menu's white cards. */
export const ledgerCard = css(ledgerLook);

/** Two of them side by side. */
export const ledgers = css({ display: 'grid', gridTemplateColumns: '[1fr 1fr]', gap: '12' });

/** A bar chart, a bar a month along the bottom: green for a month that came out ahead, red for one that did not. */
export const chartLook = css.raw({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '4',
  h: '[60px]',
  mt: '12',
  '& i': { flex: '1', maxW: '[34px]', bg: 'good.solid', borderRadius: '[5px 5px 0 0]' },
  '& i.neg': { bg: 'bad.solid' },
});

/** A bar chart. */
export const chart = css(chartLook);

/** A Stats tab's opening words, with its buttons or its Sort by list at the far end. */
export const statsHead = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12',
  '& :is(.btnrow, .choose)': { mt: '0' },
});

/** A table of figures, a row each: its name on the left, and the numbers lined up on the right. */
export const tableLook = css.raw({
  w: '[100%]',
  borderCollapse: 'collapse',
  fontSize: '13',
  '& th': {
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: '12',
    py: '4',
    px: '6',
    borderBottom: 'divider',
  },
  '& td': { textAlign: 'right', py: '2', px: '6', borderBottom: 'hairline' },
  '& :is(th, td):first-child': { textAlign: 'left' },
  '& .poor': { color: 'bad', fontWeight: 'bold' },
});

/** A table of figures. */
export const table = css(tableLook);
