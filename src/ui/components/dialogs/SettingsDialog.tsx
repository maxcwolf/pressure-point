// The settings dialog, opened from the pause menu.

import { useGame, useHud } from '../../hooks/use-hud';
import { SettingsPanel } from '../SettingsPanel';
import { BackOrResume } from './BackOrResume';
import { Dialog } from './Dialog';

/** Settings for the game in progress. */
export function SettingsDialog() {
  const hud = useHud();
  const { audio, sim } = useGame();
  return (
    <Dialog wide>
      <h2>Settings</h2>
      <div id="settings-panel">
        <SettingsPanel
          audio={audio}
          sim={sim}
          onChange={() => {
            // a switched-off discipline's menu may be open behind the dialog
            hud.menu = null;
            hud.update();
          }}
        />
      </div>{' '}
      <BackOrResume />
    </Dialog>
  );
}
