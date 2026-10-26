// Top right, beside the system buttons: the overlays the floor can be colored by, and a key to the one showing.

import { track } from '../../app/analytics';
import { gameProps } from '../../app/play-events';
import { css } from '../../styled-system/css';
import { panelCard } from '../../styled-system/recipes';
import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { OVERLAYS } from '../lib/overlays';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** Under the system buttons, over the panels down the right. */
const picker = css({
  top: 'below-bar',
  right: 'gutter',
  w: 'panel.picker',
  zIndex: 'popover',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
});

/** The picker's heading. */
const heading = css({ fontWeight: 'bold', mb: '2' });

/** An overlay to pick: its icon, then its name over what it shows; tinted teal while it is the one showing. */
const choice = css({
  display: 'grid',
  gridTemplateColumns: '[26px 1fr]',
  alignItems: 'center',
  gap: '6',
  textAlign: 'left',
  bg: 'bg.card',
  border: 'card',
  borderRadius: '10',
  py: '4',
  px: '8',
  fontWeight: 'bold',
  fontSize: '14',
  _on: { borderColor: 'accent.strong', bg: 'bg.selected' },
  '& i': { display: 'grid', placeItems: 'center' },
  '& small': { display: 'block', fontWeight: 'regular', fontSize: '12' },
});

/**
 * The key to the overlay showing: to the left of the system buttons (five of 44px, 8px apart, 14px in from the edge),
 * as tall as they are, or under them where there is no room beside them.
 */
const keyPanel = css({
  top: 'gutter',
  right: '[calc({spacing.gutter} + 5 * {sizes.round.small} + 5 * {spacing.8})]',
  h: '44',
  borderRadius: '18',
  display: 'flex',
  alignItems: 'center',
  gap: '10',
  p: '0',
  pr: '8',
  pl: '14',
  fontSize: '13',
  whiteSpace: 'nowrap',
  _max720: { top: 'below-bar', right: 'gutter' },
});

/** The overlay's icon and name. */
const keyName = css({ display: 'flex', alignItems: 'center', gap: '6' });

/**
 * The overlay's scale between the words at its ends. The floor's scales fade to clear where things are ordinary, shown
 * here over a faint floor color. `scale` and the kind of scale are for the end-to-end tests to find it by.
 */
const scale = css({
  display: 'flex',
  alignItems: 'center',
  gap: '4',
  '& i': {
    w: '96',
    h: '10',
    borderRadius: '4',
    boxShadow: 'inset',
    bgColor: 'bg.inset',
  },
  '&.diverging i': {
    bgImage:
      '[linear-gradient(90deg, {colors.overlay.bad}, {colors.overlay.fair} 25%, transparent 45%, transparent 55%, {colors.overlay.good})]',
  },
  '&.temperature i': {
    bgImage:
      '[linear-gradient(90deg, {colors.overlay.cold}, transparent 45%, transparent 55%, {colors.overlay.fair} 75%, {colors.overlay.bad})]',
  },
  '&.harm i': {
    bgImage: '[linear-gradient(90deg, {colors.overlay.bad}, {colors.overlay.fair} 40%, transparent 85%)]',
  },
  '&.condition i': {
    bgImage: '[linear-gradient(90deg, {colors.overlay.bad}, {colors.overlay.fair}, {colors.overlay.good})]',
  },
});

/**
 * The key's close button: a white disc ringed in navy, drawn like the inspector's, but in the key's row rather than in a
 * corner. `x` is for the tests.
 */
const close = css({
  position: 'static',
  flex: 'none',
  w: '24',
  h: '24',
  borderRadius: 'disc',
  border: 'outline.thin',
  bg: 'bg.card',
  fontSize: '12',
  lineHeight: 'none',
});

/** The list of overlays while it is open, or the key to the overlay showing. */
export function OverlayPicker() {
  const hud = useHud();
  const showing = OVERLAYS.find((o) => o.id === hud.overlay);
  if (hud.overlayPicker)
    return (
      <div id="overlay-picker" class={cx(panelCard(), picker)}>
        <h4 class={heading}>Color the floor by</h4>
        {OVERLAYS.map((o) => (
          <Button
            key={o.id}
            class={cx(choice, hud.overlay === o.id && 'on')}
            title={o.desc}
            onPress={() => {
              hud.overlay = hud.overlay === o.id ? null : o.id;
              hud.overlayPicker = false;
              if (hud.overlay) track('overlay_shown', { ...gameProps(hud.host.sim.s), overlay: o.id });
            }}
          >
            <i>
              <Icon id={o.icon} size={24} />
            </i>
            <span>
              {o.name}
              <small>{o.desc}</small>
            </span>
          </Button>
        ))}
        {hud.overlay && (
          <Button
            class={cx(choice, 'off')}
            onPress={() => {
              hud.overlay = null;
              hud.overlayPicker = false;
            }}
          >
            <i>✕</i>
            <span>Nothing</span>
          </Button>
        )}
      </div>
    );
  if (!showing) return null;
  return (
    <div id="overlay-key" class={cx(panelCard(), keyPanel)}>
      <b class={keyName}>
        <Icon id={showing.icon} size={20} />
        {showing.name}
      </b>
      <span class={cx('scale', scale, showing.key)} title={showing.desc}>
        <small>{showing.ends[0]}</small>
        <i />
        <small>{showing.ends[1]}</small>
      </span>
      <Button
        class={cx('x', close)}
        title="Stop coloring the floor"
        onPress={() => {
          hud.overlay = null;
        }}
      >
        ✕
      </Button>
    </div>
  );
}
