// The Plans overlay's key, top right in place of an overlay's scale: every room pencilled in, what building them all
// would cost and how many no longer fit, with a way to go to each or build it, and to hide the plans.

import { css } from '../../styled-system/css';
import { goButton, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { planRows, plansLine } from '../lib/sketches';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** At the head of the right-hand column, over the messages and the inspector, wider than they are. */
const key = css({
  flex: 'none',
  alignSelf: 'flex-end',
  w: '[min({sizes.panel.plans}, calc(var(--vw) - 28px))]',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  fontSize: '13',
});

/** The key's title, with the tag saying it is an overlay at the far end. */
const heading = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontWeight: 'bold',
  fontSize: '15',
});

/** A dashed tag saying this is an overlay, drawn as the sketches' outlines are. */
const tag = css({
  fontSize: '12',
  fontWeight: 'bold',
  border: '[{borderWidths.fine} dashed {colors.outline}]',
  borderRadius: '10',
  py: '0',
  px: '6',
});

/** How many are pencilled in, what they would cost and how many no longer fit, in bold. */
const summary = css({ m: '0', fontWeight: 'bold', fontSize: '12' });

/** A row per sketch, scrolling once there are many. */
const list = css({ listStyle: 'none', m: '0', p: '0', maxH: 'panel.plans-list', overflowY: 'auto' });

/** A sketch: its icon, its name over its size, its fit, its price, and Go and Build, under a faint line. */
const row = css({
  display: 'grid',
  gridTemplateColumns: '[20px 1fr auto auto auto auto]',
  alignItems: 'center',
  gap: '4',
  py: '4',
  px: '0',
  borderTop: '[{borderWidths.fine} solid {colors.border}]',
});

/** The room's name, cut short to fit, over its size and day. */
const what = css({
  display: 'flex',
  flexDirection: 'column',
  minW: '0',
  lineHeight: 'tight',
  '& b': { fontWeight: 'bold', fontSize: '13', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  '& small': { fontSize: '11', opacity: 'muted' },
});

/** Whether it fits: green when it does, amber when it no longer does, plain while it waits. */
const fit = css({
  fontSize: '11',
  fontWeight: 'bold',
  border: '[{borderWidths.fine} solid {colors.border.strong}]',
  borderRadius: '8',
  py: '0',
  px: '4',
  whiteSpace: 'nowrap',
  '&.ok': { bg: 'good.bg', color: 'good', borderColor: 'good' },
  '&.unfit': { bg: 'warn.bg', color: 'warn', borderColor: 'sketch.unfit' },
});

/** What building it would cost. */
const price = css({ fontWeight: 'bold', fontSize: '12' });

/** A row's small buttons, white and outlined in navy. */
const rowButtonLook = css.raw({
  color: 'fg',
  border: 'outline.fine',
  borderRadius: '6',
  py: '0',
  px: '4',
  fontSize: '11',
  fontWeight: 'bold',
  bg: 'bg.card',
});

/** Go, which takes the camera to the sketch: a go button made small and white, keeping its drop and sitting lower. */
const goTo = css(rowButtonLook);

/** Build, which builds it as its panel does, in green. */
const build = css(rowButtonLook, { bg: 'go', color: 'fg.on-accent' });

/** Hide plans, which turns the overlay off. */
const hide = css({
  alignSelf: 'flex-start',
  border: 'outline',
  borderRadius: '12',
  py: '4',
  px: '12',
  fontWeight: 'bold',
  bg: 'control',
  boxShadow: 'low',
});

/** The list of sketches while the Plans overlay is on. Building or erasing one leaves the overlay on. */
export function PlansKey() {
  const hud = useHud();
  const { sim, view, tools } = useGame();
  const rows = planRows(sim.world);
  return (
    <div id="plans-key" class={cx(panelCard(), key)}>
      <h4 class={heading}>
        <span>✎ Plans</span>
        <span class={tag}>overlay</span>
      </h4>
      <p class={cx('sub', summary)}>{plansLine(sim.world)}</p>
      {rows.length > 0 && (
        <ul class={list}>
          {rows.map((r) => (
            <li key={r.id} data-sketch={r.id} class={row}>
              <Icon id={r.icon} size={20} />
              <span class={what}>
                <b>{r.name}</b>
                <small>{r.sub}</small>
              </span>
              <span class={cx(fit, r.standing === 'fits' && 'ok', r.unfit && 'unfit')}>{r.chip}</span>
              <span class={price}>{r.price}</span>
              <Button
                class={cx(goButton(), goTo)}
                title="Take the camera there"
                onPress={() => {
                  const sk = sim.sketch(r.id);
                  if (sk) view.lookAt(sk.x + sk.w / 2, sk.y + sk.h / 2);
                }}
              >
                Go
              </Button>
              <Button
                class={build}
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
        class={hide}
        onPress={() => {
          hud.overlay = null;
        }}
      >
        Hide plans
      </Button>
    </div>
  );
}
