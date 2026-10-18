// Top right, beside the system buttons: the overlays the floor can be colored by, and a key to the one showing.

import './OverlayPicker.css';

import { track } from '../../app/analytics';
import { gameProps } from '../../app/play-events';
import { useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { OVERLAYS } from '../lib/overlays';
import { Button } from './common/Button';

/** The list of overlays while it is open, or the key to the overlay showing. */
export function OverlayPicker() {
  const hud = useHud();
  const showing = OVERLAYS.find((o) => o.id === hud.overlay);
  if (hud.overlayPicker)
    return (
      <div id="overlay-picker" class="panel">
        <h4>Color the floor by</h4>
        {OVERLAYS.map((o) => (
          <Button
            key={o.id}
            class={cx('overlay-choice', hud.overlay === o.id && 'on')}
            title={o.desc}
            onPress={() => {
              hud.overlay = hud.overlay === o.id ? null : o.id;
              hud.overlayPicker = false;
              if (hud.overlay) track('overlay_shown', { ...gameProps(hud.host.sim.s), overlay: o.id });
            }}
          >
            <i>{o.icon}</i>
            <span>
              {o.name}
              <small>{o.desc}</small>
            </span>
          </Button>
        ))}
        {hud.overlay && (
          <Button
            class="overlay-choice off"
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
    <div id="overlay-key" class="panel">
      <b>{`${showing.icon} ${showing.name}`}</b>
      <span class={cx('scale', showing.palette)}>
        <small>{showing.ends?.[0] ?? 'Poor'}</small>
        <i />
        <small>{showing.ends?.[1] ?? 'Good'}</small>
      </span>
      <Button
        class="x"
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
