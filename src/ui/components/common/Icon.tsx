// The game's own icons, drawn from the sprite sheets that `yarn icons` builds from src/ui/icons/: one for 20 pixels
// and under, with simpler drawings where an icon has one, and one for everything bigger. Each icon measures the size it
// comes out at, picks its sheet and the weight of its lines by that, and lands on whole pixels of the screen.

import './Icon.css';

import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import type { IconId } from '../../../core/data';
import sprite from '../../icons/generated/sprite.svg?raw';
import spriteSmall from '../../icons/generated/sprite-small.svg?raw';
import type { IconLine } from '../../lib/icon-line';

let mounted = false;

/**
 * Put both sprite sheets on the page, once. They go inline rather than being linked to, as the desktop app loads the
 * game from a file, and a page loaded that way cannot draw from another file's symbols.
 */
function mountSprite() {
  if (mounted) return;
  mounted = true;
  document.body.insertAdjacentHTML('afterbegin', sprite + spriteSmall);
}

/** The size, in pixels, at and under which an icon draws from the small sheet. */
export const SMALL_SIZE = 20;

/**
 * Whether an icon that comes out this many pixels of the screen across draws from the small sheet. It goes by the
 * pixels, not by how the size was written: a 22-pixel icon and one of 1.3em that comes to 22 are drawn alike, and an
 * icon of 16 on a screen of two pixels to one has 32 of them, and room for its full drawing.
 */
export const isSmall = (px: number) => Math.round(px) <= SMALL_SIZE;

/** How wide the interface draws an icon's lines where it has room: 4/5 of drawn, as `SPRITE_STROKE` in scripts/icons.mjs. */
export const LINE = 0.8;
/** The thinnest an outline may come out, in pixels of the screen: any thinner, and it smears to grey. */
export const MIN_LINE = 1.4;
/** The most an outline is made heavier than drawn, so the tiniest icons stay shapes and not blots. */
export const MAX_LINE = 1.5;

/**
 * How wide to draw an icon's lines, as a share of their drawn width, when it comes out this many pixels of the screen
 * across: 4/5 where there is room, and heavier as it shrinks, so that its 2.25-wide outline never comes out under
 * `MIN_LINE` pixels. It changes smoothly with the size, so no size draws a step heavier than the one beside it.
 */
export function lineScale(devicePx: number) {
  const k = (MIN_LINE * 32) / (2.25 * Math.max(devicePx, 1));
  return Math.round(Math.min(MAX_LINE, Math.max(LINE, k)) * 100) / 100;
}

/** How big an icon this size most likely comes out, before it has been laid out: words are about 15 pixels high. */
function guessPx(size: number | string) {
  if (typeof size === 'number') return size;
  if (size.endsWith('em')) return parseFloat(size) * 15;
  return 30;
}

/** The size an icon is given, as a length rounded to whole pixels of the screen, so it lands on them and is not blurred. */
export const wholePixels = (size: number | string, dpr: number) =>
  `round(nearest, ${typeof size === 'number' ? `${size}px` : size}, ${Math.round(10000 / dpr) / 10000}px)`;

/** What an icon is told of its size: how many pixels of the screen across it comes out. */
type Measured = (devicePx: number) => void;

/** Every icon on the page, and what to tell it when its size changes. */
const shown = new Map<Element, Measured>();
let observer: ResizeObserver | null = null;

/** Start watching an icon's size, telling it whenever that changes. */
function watch(el: Element, measured: Measured) {
  if (typeof ResizeObserver === 'undefined') return () => undefined;
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const device =
        entry.devicePixelContentBoxSize[0]?.inlineSize ?? entry.contentRect.width * (window.devicePixelRatio || 1);
      shown.get(entry.target)?.(device);
    }
  });
  shown.set(el, measured);
  try {
    observer.observe(el, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(el);
  }
  return () => {
    observer?.unobserve(el);
    shown.delete(el);
  };
}

/**
 * An icon, a square this many pixels across (or a length such as '1.25em', to match the words beside it), read out as
 * its label if it has one and passed over if not. It comes out at whole pixels of the screen. Once laid out it knows
 * how many pixels it has: at 20 and under it is the icon's small form, and its lines are as heavy as its size needs.
 */
export function Icon({
  id,
  size = 24,
  label,
  class: className,
}: {
  id: IconId;
  size?: number | string;
  label?: string;
  class?: string;
}) {
  mountSprite();
  const ref = useRef<SVGSVGElement>(null);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const [device, setDevice] = useState(() => guessPx(size) * dpr);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return watch(el, (d) => setDevice((was) => (Math.abs(was - d) < 0.01 ? was : d)));
  }, []);
  const length = wholePixels(size, dpr);
  const small = isSmall(device);
  // a hand-drawn small drawing is drawn for 16 pixels on a plain screen, where the curve gives 1.24
  const smallLine = Math.round((lineScale(device) / 1.24) * 100) / 100;
  return (
    <svg
      ref={ref}
      class={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      style={{ width: length, height: length, '--icon-line': lineScale(device), '--icon-small-line': smallLine }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <use href={`#icon-${small ? 'small-' : ''}${id}`} />
    </svg>
  );
}

/**
 * Words with an icon before them, the icon as tall as a capital and a little over, so it reads as part of the line;
 * just the words when there is no icon.
 */
export function IconText({
  id,
  children,
  class: className,
}: {
  id?: IconId | undefined;
  children: ComponentChildren;
  class?: string | undefined;
}) {
  if (!id) return className ? <span class={className}>{children}</span> : <>{children}</>;
  return (
    <span class={className ? `icon-text ${className}` : 'icon-text'}>
      <Icon id={id} size="1.3em" />
      <span>{children}</span>
    </span>
  );
}

/** A line of words with its icon, as the notes in ui/lib give them. */
export function Line({ line, class: className }: { line: IconLine; class?: string | undefined }) {
  return (
    <IconText id={line.icon} class={className}>
      {line.text}
    </IconText>
  );
}
