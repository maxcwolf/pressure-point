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
  top: '[66px]',
  right: '[14px]',
  w: '[270px]',
  zIndex: '[5]',
  display: 'flex',
  flexDirection: 'column',
  gap: '[5px]',
});

/** The picker's heading. */
const heading = css({ fontWeight: 'bold', mb: 'xxs' });

/** An overlay to pick: its icon, then its name over what it shows; tinted teal while it is the one showing. */
const choice = css({
  display: 'grid',
  gridTemplateColumns: '[26px 1fr]',
  alignItems: 'center',
  gap: 's',
  textAlign: 'left',
  bg: 'white',
  border: 'card',
  borderRadius: '[10px]',
  py: 'xs',
  px: 'm',
  fontWeight: 'bold',
  fontSize: '14',
  _on: { borderColor: 'teal-dark', bg: 'teal-wash' },
  '& i': { display: 'grid', placeItems: 'center' },
  '& small': { display: 'block', fontWeight: '[400]', fontSize: '12' },
});

/**
 * The key to the overlay showing: to the left of the system buttons (five of 44px, 8px apart, 14px in from the edge),
 * as tall as they are, or under them where there is no room beside them.
 */
const keyPanel = css({
  top: '[14px]',
  right: '[calc(14px + 5 * 44px + 5 * 8px)]',
  h: '[44px]',
  borderRadius: '[22px]',
  display: 'flex',
  alignItems: 'center',
  gap: '[10px]',
  p: '[0 8px 0 14px]',
  fontSize: '13',
  whiteSpace: 'nowrap',
  _max720: { top: '[calc(14px + 44px + 8px)]', right: '[14px]' },
});

/** The overlay's icon and name. */
const keyName = css({ display: 'flex', alignItems: 'center', gap: 's' });

/**
 * The overlay's scale between the words at its ends. The floor's scales fade to clear where things are ordinary, shown
 * here over a faint floor color. `scale` and the kind of scale are for the end-to-end tests to find it by.
 */
const scale = css({
  display: 'flex',
  alignItems: 'center',
  gap: '[5px]',
  '& i': {
    w: '[90px]',
    h: '[10px]',
    borderRadius: '[5px]',
    boxShadow: '[inset 0 0 0 1px {colors.ink.20}]',
    bgColor: 'sand',
  },
  '&.diverging i': {
    bgImage:
      '[linear-gradient(90deg, {colors.overlay-bad}, {colors.overlay-fair} 25%, transparent 45%, transparent 55%, {colors.overlay-good})]',
  },
  '&.temperature i': {
    bgImage:
      '[linear-gradient(90deg, {colors.overlay-cold}, transparent 45%, transparent 55%, {colors.overlay-fair} 75%, {colors.overlay-bad})]',
  },
  '&.harm i': {
    bgImage: '[linear-gradient(90deg, {colors.overlay-bad}, {colors.overlay-fair} 40%, transparent 85%)]',
  },
  '&.condition i': {
    bgImage: '[linear-gradient(90deg, {colors.overlay-bad}, {colors.overlay-fair}, {colors.overlay-good})]',
  },
});

/**
 * The key's close button: a white disc ringed in navy, drawn like the inspector's, but in the key's row rather than in a
 * corner. `x` is for the tests.
 */
const close = css({
  position: 'static',
  flex: 'none',
  w: '[26px]',
  h: '[26px]',
  borderRadius: '[50%]',
  border: 'control',
  bg: 'white',
  fontSize: '12',
  lineHeight: '[1]',
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
