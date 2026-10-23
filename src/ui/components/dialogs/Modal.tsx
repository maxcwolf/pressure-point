// Whichever dialog is open over the game.

import type { ComponentChildren } from 'preact';

import { Still, useExit } from '../../hooks/use-exit';
import { useHud } from '../../hooks/use-hud';
import type { DialogId } from '../../hud';
import { cx } from '../../lib/cx';
import { AwardsDialog } from './AwardsDialog';
import { BankruptDialog } from './BankruptDialog';
import { BuyPlotDialog } from './BuyPlotDialog';
import { ConfirmCancelCourse } from './ConfirmCancelCourse';
import { ConfirmDismissMessages } from './ConfirmDismissMessages';
import { ConfirmFire } from './ConfirmFire';
import { ConfirmNewGame } from './ConfirmNewGame';
import { FeedbackDialog } from './FeedbackDialog';
import { KarmaDialog } from './KarmaDialog';
import { LessonDialog } from './LessonDialog';
import { PauseMenu } from './PauseMenu';
import { PayrollDialog } from './PayrollDialog';
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
    case 'feedback':
      return <FeedbackDialog />;
    case 'confirm-new':
      return <ConfirmNewGame />;
    case 'confirm-fire':
      return <ConfirmFire />;
    case 'confirm-cancel-course':
      return <ConfirmCancelCourse />;
    case 'confirm-dismiss':
      return <ConfirmDismissMessages />;
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
    case 'payroll':
      return <PayrollDialog />;
    case 'bankrupt':
      return <BankruptDialog />;
    case 'update':
      return <UpdateDialog />;
    case 'lesson':
      return <LessonDialog />;
  }
}

/** The open dialog, if any, and for a moment after it closes the last of it fading away, the game no longer dimmed. */
export function Modal() {
  const { dialog } = useHud();
  const { shown, leaving } = useExit(dialog);
  return (
    <div id="modal" class={cx(leaving && 'leaving')}>
      {shown && (
        <Still key={shown} still={leaving}>
          {contents(shown)}
        </Still>
      )}
    </div>
  );
}
