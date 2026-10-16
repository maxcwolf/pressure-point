// Whichever dialog is open over the game.

import type { ComponentChildren } from 'preact';

import { useHud } from '../../hooks/use-hud';
import type { DialogId } from '../../hud';
import { AwardsDialog } from './AwardsDialog';
import { BuyPlotDialog } from './BuyPlotDialog';
import { ConfirmNewGame } from './ConfirmNewGame';
import { KarmaDialog } from './KarmaDialog';
import { PauseMenu } from './PauseMenu';
import { SavesDialog } from './SavesDialog';
import { SettingsDialog } from './SettingsDialog';
import { StarDialog } from './StarDialog';
import { UpdateDialog } from './UpdateDialog';
import { VisitDialog } from './VisitDialog';

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
    case 'karma':
      return <KarmaDialog />;
    case 'awards':
      return <AwardsDialog />;
    case 'visit':
      return <VisitDialog />;
    case 'buy-plot':
      return <BuyPlotDialog />;
    case 'update':
      return <UpdateDialog />;
  }
}

/** The open dialog, if any. */
export function Modal() {
  const { dialog } = useHud();
  return <div id="modal">{dialog && contents(dialog)}</div>;
}
