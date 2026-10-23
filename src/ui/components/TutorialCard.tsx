// The tutorial's step in hand, in the advisor's spot: which step it is, what it asks and why, a button that shows
// where, and a way to skip the rest.

import './TutorialCard.css';

import type { TutorialStep } from '../../core/sim/tutorial';
import { useHud } from '../hooks/use-hud';
import { Button } from './common/Button';

/** The card for a step, with Show me when there is a menu to open or someone to show. */
export function TutorialCard({ step }: { step: TutorialStep }) {
  const hud = useHud();
  const showable = (step.want !== undefined && step.want.kind !== 'look') || step.about !== undefined;
  return (
    <div class="note tutorial-card">
      <div class="top">
        <span class="kicker">{`Tutorial · step ${step.n} of ${step.of}`}</span>
        <Button
          class="skip"
          onPress={() => {
            hud.skipTutorial();
          }}
        >
          Skip the tutorial
        </Button>
      </div>
      <b class="title">{step.title}</b>
      <p>{step.text}</p>
      {showable && (
        <Button
          class="show"
          onPress={() => {
            hud.showStep(step);
          }}
        >
          Show me
        </Button>
      )}
    </div>
  );
}
