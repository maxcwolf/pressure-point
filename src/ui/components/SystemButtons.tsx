// Top right: sound, music and the pause menu.

import './SystemButtons.css';

import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { Button } from './common/Button';

/** The sound, music and menu buttons. */
export function SystemButtons() {
  const hud = useHud();
  const { audio } = useGame();
  return (
    <div id="sys">
      <Button
        class="round small"
        title="Sound effects"
        onPress={() => {
          audio.toggleSound();
        }}
      >
        {audio.sound ? '🔊' : '🔇'}
      </Button>{' '}
      <Button
        class={cx('round small', !audio.music && 'off')}
        title="Music"
        onPress={() => {
          audio.toggleMusic();
        }}
      >
        🎵
      </Button>{' '}
      <Button
        class="round small"
        title="Menu"
        onPress={() => {
          hud.open('pause');
        }}
      >
        ☰
      </Button>
    </div>
  );
}
