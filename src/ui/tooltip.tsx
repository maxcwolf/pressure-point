// Tooltips: the words a control shows while the pointer rests on it, drawn in the game's own style rather than the browser's.

import { type ComponentChild, options, render, type VNode } from 'preact';

import { loadDisplay } from '../storage/display';
import { css } from '../styled-system/css';
import { Icon } from './components/common/Icon';

/** The tooltip: a navy bubble with a point toward what it explains, a gold heading and keys drawn as keys. */
const bubble = css({
  position: 'fixed',
  left: '0',
  top: '0',
  zIndex: 'tooltip',
  pointerEvents: 'none',
  w: 'max-content',
  // drawn at the interface's size over the game (set as it shows), and at the usual size elsewhere
  zoom: 'var(--ui-scale)',
  maxW: '[min({sizes.panel.tooltip}, calc(100vw / var(--ui-scale) - 16px))]',
  p: '12',
  pt: '6',
  pb: '8',
  bg: 'bg.inverse',
  color: 'fg.inverse',
  borderRadius: '12',
  boxShadow: 'float',
  fontSize: '14',
  fontWeight: 'medium',
  lineHeight: 'snug',
  textWrap: 'pretty',
  // it rises a little toward what it explains as it appears
  animation: '[tip-in {durations.fast} {easings.out}]',
  '&[hidden]': { display: 'none' },
  // the point, under the bubble or, when it shows below what it explains, over it
  '&::after': {
    content: "''",
    position: 'absolute',
    left: '[var(--arrow-x, 50%)]',
    bottom: '-4',
    w: '12',
    h: '12',
    ml: '[-6px]',
    bg: 'bg.inverse',
    borderRadius: '2',
    transform: 'rotate(45deg)',
  },
  '&.below::after': { bottom: 'auto', top: '-4' },
  '& strong': { display: 'block', color: 'star', fontSize: '14', fontWeight: 'bold', mb: '[1px]' },
  '& kbd': {
    display: 'inline-block',
    fontFamily: 'inherit',
    fontSize: '12',
    fontWeight: 'bold',
    lineHeight: 'relaxed',
    minW: '20',
    textAlign: 'center',
    py: '0',
    px: '6',
    ml: '6',
    color: 'fg.inverse',
    bg: 'bg.inverse-subtle',
    border: '[{borderWidths.fine} solid {colors.border.inverse}]',
    borderBottomWidth: 'thick',
    borderRadius: '6',
    verticalAlign: '[1px]',
  },
  '& kbd + kbd': { ml: '4' },
  '&.below': { animationName: 'tip-in-below' },
  // an item's tooltip (ItemTip) is a little wider than most, for its list of stats
  '&.rich': { maxW: '[min(300px, calc(var(--vw) - 16px))]' },
  _motionReduce: { animation: 'none' },
  // an icon in the navy bubble sits on a cream chip, or its navy outline would vanish
  '& .icon': { bg: 'bg.panel', borderRadius: '6', p: '[1.5px]' },
});

/** How long the pointer rests on something before its tooltip shows. */
const DELAY = 380;
/** How soon after one tooltip goes that the next shows at once, so running along a row of buttons reads each straight off. */
const GRACE = 300;
/** The space between a tooltip and what it explains, and between a tooltip and the edge of the window. */
const GAP = 10;
const MARGIN = 8;

/** Where a title starts with a short name, as in 'Overlays: color the floor', that name becomes the tooltip's heading. */
const HEADING = /^([^.:]{1,32}): (.+)$/s;
/** Where a title ends with the keys for it, as in 'Pause (Space)', the keys are drawn as keys. */
const KEYS = /^(.+) \(([^()]{1,24})\)$/s;

/** Split a title into a heading, the words and the keys that go with it. */
export function parseTip(text: string): { heading: string; body: string; keys: string[] } {
  let heading = '';
  let body = text;
  let keys: string[] = [];
  const [, rest, named] = KEYS.exec(body) ?? [];
  if (rest && named) {
    const parts = named.split(/ and | or |, /);
    if (parts.every((p) => p.length <= 7)) {
      body = rest;
      keys = parts;
    }
  }
  const [, name, words] = HEADING.exec(body) ?? [];
  if (name && words) {
    heading = name;
    body = words.charAt(0).toUpperCase() + words.slice(1);
  }
  return { heading, body, keys };
}

/** Draws a tooltip richer than words, from the value after its kind in `data-tip-rich="kind:value"`. */
type RichTip = (value: string) => ComponentChild;
const richTips = new Map<string, RichTip>();

/**
 * Draw the tooltip of an element marked `data-tip-rich="kind:value"` with this, rather than as its title's words. The
 * element still needs a title, which a screen reader hears and which shows wherever nothing draws its kind.
 */
export function addRichTip(kind: string, draw: RichTip) {
  richTips.set(kind, draw);
}

/** The rich tooltip for a `data-tip-rich` value, or null if nothing draws its kind. */
function richTip(spec: string | undefined): ComponentChild {
  if (!spec) return null;
  const at = spec.indexOf(':');
  const draw = at > 0 ? richTips.get(spec.slice(0, at)) : undefined;
  return draw ? draw(spec.slice(at + 1)) : null;
}

/** What a tooltip says. */
function Tip({ text }: { text: string }) {
  const { heading, body, keys } = parseTip(text);
  return (
    <>
      {heading && <strong>{heading}</strong>}
      {body}
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </>
  );
}

/** Whether an element's children show any words, as far as a screen reader is concerned. */
function hasWords(children: unknown): boolean {
  if (Array.isArray(children)) return children.some(hasWords);
  if (typeof children === 'number') return true;
  if (typeof children === 'string') return children.trim() !== '';
  if (!children || typeof children !== 'object' || !('type' in children)) return false;
  const { type, props } = children as VNode<Record<string, unknown>>;
  // an icon is words only when it is labeled; any other component may draw words of its own, so count it as words
  if (type === Icon) return !!props.label;
  if (typeof type !== 'string') return true;
  return !props['aria-hidden'] && hasWords(props.children);
}

let installed = false;

/** Draw every title on the page as one of the game's tooltips, from now on. */
export function installTooltips() {
  if (installed) return;
  installed = true;

  // Every element given a title keeps it as data-tip instead, so the browser draws no tooltip of its own. A screen reader
  // still hears it as the browser would have it: as the element's name where it shows no words, or else as its description.
  const nextVnode = options.vnode?.bind(options);
  /** Move an element's title to data-tip. */
  options.vnode = (vnode) => {
    const props = vnode.props as Record<string, unknown>;
    if (typeof vnode.type === 'string' && 'title' in props) {
      const { title } = props;
      delete props.title;
      props['data-tip'] = title;
      if (!props['aria-label'] && !hasWords(props.children)) props['aria-label'] = title;
      else props['aria-description'] = title;
    }
    nextVnode?.(vnode);
  };

  const tip = document.createElement('div');
  tip.id = 'tip';
  tip.className = bubble;
  // the element it explains already carries the same words for a screen reader, so this is for the eye alone
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  document.body.appendChild(tip);

  /** The element the pointer is resting on, whose tooltip is showing or about to. */
  let target: HTMLElement | null = null;
  /** An element clicked, whose tooltip stays away until the pointer leaves it. */
  let dismissed: Element | null = null;
  let text = '';
  let timer = 0;
  let frame = 0;
  let lastShown = -Infinity;

  /** Put the tooltip above what it explains, or below where there is no room above, and keep it in the window. */
  const place = () => {
    if (!target?.isConnected || !target.dataset.tip) {
      hide();
      return;
    }
    const shows = target.dataset.tipRich ?? target.dataset.tip;
    if (shows !== text) {
      text = shows;
      const rich = richTip(target.dataset.tipRich);
      tip.classList.toggle('rich', !!rich);
      render(rich ?? <Tip text={target.dataset.tip} />, tip);
    }
    // over the game, drawn at the interface's size like what it explains; its place is worked out in the window's pixels
    // and given in its own, which the size multiplies
    const scale = target.closest('#ui') ? loadDisplay().uiScale : 1;
    tip.style.setProperty('--ui-scale', String(scale));
    const r = target.getBoundingClientRect();
    const { width: w, height: h } = tip.getBoundingClientRect();
    const below = r.top - GAP - h < MARGIN;
    const centre = r.left + r.width / 2;
    const x = Math.min(Math.max(centre - w / 2, MARGIN), innerWidth - MARGIN - w);
    const y = below ? Math.min(r.bottom + GAP, innerHeight - MARGIN - h) : r.top - GAP - h;
    tip.classList.toggle('below', below);
    tip.style.transform = `translate(${Math.round(x / scale)}px, ${Math.round(y / scale)}px)`;
    tip.style.setProperty(
      '--arrow-x',
      `${Math.round(Math.min(Math.max(centre - x, 14 * scale), w - 14 * scale) / scale)}px`,
    );
    frame = requestAnimationFrame(place);
  };

  /** Show the tooltip for what the pointer has rested on. */
  const show = () => {
    if (!target?.isConnected) return;
    text = '';
    tip.hidden = false;
    place();
  };

  /** Take the tooltip away, and forget what it was for. */
  function hide() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    if (!tip.hidden) {
      tip.hidden = true;
      lastShown = performance.now();
    }
    target = null;
  }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip]') : null;
    if (el === target) return;
    hide();
    if (el !== dismissed) dismissed = null;
    if (!el?.dataset.tip || el === dismissed) return;
    target = el;
    timer = window.setTimeout(show, performance.now() - lastShown < GRACE ? 0 : DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) {
      hide();
      dismissed = null;
    }
  });
  // a click puts the tooltip away like the browser's own, except on a locked button, where it says why nothing happened
  document.addEventListener(
    'pointerdown',
    () => {
      if (target?.classList.contains('locked')) return;
      dismissed = target;
      hide();
    },
    true,
  );
  document.addEventListener('wheel', hide, { passive: true });
  document.addEventListener('keydown', hide);
  window.addEventListener('blur', hide);
}
