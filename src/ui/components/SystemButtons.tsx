// Top right: turning the camera, overlays, sound, music and the pause menu.

import './SystemButtons.css';

import { loadControls } from '../../storage/controls';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { keyLabel } from '../lib/keys';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** The turn, overlay, sound, music and menu buttons. */
export function SystemButtons() {
  const hud = useHud();
  const { audio, view } = useGame();
  const { keys } = loadControls();
  return (
    <div id="sys">
      <Button
        class="round small turn"
        title={`Turn the camera (${keyLabel(keys.turnLeft)} and ${keyLabel(keys.turnRight)})`}
        onPress={() => {
          view.turnCamera(1);
        }}
      >
        <Icon id="ui-turn" size={22} />
      </Button>{' '}
      <Button
        class={cx('round small', (hud.overlay !== null || hud.overlayPicker) && 'on')}
        title="Overlays: color the floor by how things stand"
        onPress={() => {
          hud.overlayPicker = !hud.overlayPicker;
        }}
      >
        <Icon id="ui-overlays" size={22} />
      </Button>{' '}
      <Button
        class="round small"
        title="Sound effects"
        onPress={() => {
          audio.toggleSound();
        }}
      >
        <Icon id={audio.sound ? 'ui-sound' : 'ui-mute'} size={22} />
      </Button>{' '}
      <Button
        class={cx('round small', !audio.music && 'off')}
        title="Music"
        onPress={() => {
          audio.toggleMusic();
        }}
      >
        <Icon id="ui-music" size={22} />
      </Button>{' '}
      <Button
        class="round small"
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
