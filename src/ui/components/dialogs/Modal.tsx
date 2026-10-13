// Whichever dialog is open over the game.

import type { ComponentChildren } from 'preact';

import { useHud } from '../../hooks/use-hud';
import type { DialogId } from '../../hud';
import { ConfirmNewGame } from './ConfirmNewGame';
import { PauseMenu } from './PauseMenu';
import { SavesDialog } from './SavesDialog';
import { SettingsDialog } from './SettingsDialog';
import { StarDialog } from './StarDialog';

/** The contents of a dialog. */
function contents(dialog: DialogId): ComponentChildren {
  switch (dialog) {
    case 'pause':
      return <PauseMenu />;
    case 'settings':
      return <SettingsDialog />;
    case 'saves':
      return <SavesDialog />;
    case 'confirm-new':
      return <ConfirmNewGame />;
    case 'star':
      return <StarDialog />;
  }
}

/** The open dialog, if any. */
export function Modal() {
  const { dialog } = useHud();
  return <div id="modal">{dialog && contents(dialog)}</div>;
}
