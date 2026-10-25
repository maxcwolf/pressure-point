// Top right: turning the camera, overlays, sound, music and the pause menu.

import { loadControls } from '../../storage/controls';
import { css } from '../../styled-system/css';
import { roundButton } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { keyLabel } from '../lib/keys';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** Top right, in a row. */
const row = css({ top: '[14px]', right: '[14px]', display: 'flex', gap: '8' });

/** The turn, overlay, sound, music and menu buttons. */
export function SystemButtons() {
  const hud = useHud();
  const { audio, view } = useGame();
  const { keys } = loadControls();
  return (
    <div id="sys" class={row}>
      <Button
        class={cx(roundButton({ size: 'small' }), 'turn')}
        title={`Turn the camera (${keyLabel(keys.turnLeft)} and ${keyLabel(keys.turnRight)})`}
        onPress={() => {
          view.turnCamera(1);
        }}
      >
        <Icon id="ui-turn" size={22} />
      </Button>{' '}
      <Button
        class={cx(roundButton({ size: 'small' }), (hud.overlay !== null || hud.overlayPicker) && 'on')}
        title="Overlays: color the floor by how things stand"
        onPress={() => {
          hud.overlayPicker = !hud.overlayPicker;
        }}
      >
        <Icon id="ui-overlays" size={22} />
      </Button>{' '}
      <Button
        class={roundButton({ size: 'small' })}
        title="Sound effects"
        onPress={() => {
          audio.toggleSound();
        }}
      >
        <Icon id={audio.sound ? 'ui-sound' : 'ui-mute'} size={22} />
      </Button>{' '}
      <Button
        class={cx(roundButton({ size: 'small' }), !audio.music && 'off')}
        title="Music"
        onPress={() => {
          audio.toggleMusic();
        }}
      >
        <Icon id="ui-music" size={22} />
      </Button>{' '}
      <Button
        class={roundButton({ size: 'small' })}
        title="Menu"
        onPress={() => {
          hud.open('pause');
        }}
      >
        <Icon id="ui-menu" size={22} />
      </Button>
    </div>
  );
}
