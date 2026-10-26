// Scroll cues: a card that holds more than it shows says so, with a fade at the edge the rest is past (and a ScrollTab).

/** The cards and lists that scroll when they hold more than fits. The menus, whose rows of cards cut off, go without. */
const SCROLLERS = ['.insp', '.dialog.wide', '.save-list', '.title-panel', '.title-sub'].join(', ');

/** Content this close to an edge, in pixels, counts as showing. */
const SLACK = 2;
const cued = new Set<HTMLElement>();
let frame = 0;

/** Which edges have content past them, as data-more: 'above', 'below', 'above below' or '' when it all shows. */
function measure(el: HTMLElement): void {
  const { overflowY } = getComputedStyle(el);
  const scrolls = overflowY === 'auto' || overflowY === 'scroll';
  const above = scrolls && el.scrollTop > SLACK;
  const below = scrolls && el.scrollHeight - el.clientHeight - el.scrollTop > SLACK;
  const more = [above && 'above', below && 'below'].filter(Boolean).join(' ');
  if (el.dataset.more !== more) el.dataset.more = more;
}

/** Re-measure every cued card still on the page, once per frame however many changes ask. */
function schedule(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    for (const el of cued) {
      if (el.isConnected) measure(el);
      else cued.delete(el);
    }
  });
}

/** Watch one card for what it shows. */
function watch(el: HTMLElement, sizes: ResizeObserver): void {
  cued.add(el);
  el.addEventListener('scroll', () => measure(el), { passive: true });
  sizes.observe(el);
  measure(el);
}

/** Start watching every scroller on the page now and any that appears later. */
export function installScrollCues(): void {
  const sizes = new ResizeObserver(schedule);
  /** Take up any scroller not yet watched, and re-measure the rest. */
  const adopt = () => {
    for (const el of document.body.querySelectorAll<HTMLElement>(SCROLLERS)) {
      if (!cued.has(el)) watch(el, sizes);
    }
    schedule();
  };
  // anything added may be a scroller; anything else that changes may change what one holds
  new MutationObserver((records) => {
    if (records.some((r) => r.type === 'childList')) adopt();
    else schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  window.addEventListener('resize', schedule);
  adopt();
}
