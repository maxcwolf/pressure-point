// Bottom left: the advisor's current nudge, held long enough to read, its first sentence bold and a word over it saying
// what kind it is if it has one. One about someone or something takes you there when clicked. While the tutorial has
// a step in hand, its card instead, which is never held.

import './Advisor.css';

import { useGame, useHud } from '../hooks/use-hud';
import { headline } from '../lib/advice-hold';
import { cx } from '../lib/cx';
import { Button } from './common/Button';
import { Icon } from './common/Icon';
import { TutorialCard } from './TutorialCard';

/** The advisor, who steps aside while a build menu or a blueprint is open in the same spot. */
export function Advisor() {
  const hud = useHud();
  const { sim, tools } = useGame();
  if (hud.menu || tools.plan) return <div id="advisor" />;
  const raw = sim.adviceNote();
  const { step } = raw;
  if (step)
    return (
      <div id="advisor">
        <div class="face">
          <Icon id="ui-advisor" size={36} />
        </div>
        <TutorialCard step={step} />
      </div>
    );
  const note = hud.advice.show(raw, performance.now() / 1000, (about) => sim.whereIs(about) !== null);
  const { head, rest } = headline(note.text);
  const { about } = note;
  // keyed by the note, so a new one fades in while the box stays where it is
  const body = (
    <span key={note.id} class="words">
      {note.label && <span class="kicker">{note.label}</span>}
      <b>{head}</b>
      {rest && <span class="rest">{rest}</span>}
    </span>
  );
  const look = cx('note', note.level === 'alarm' && 'alarm');
  return (
    <div id="advisor">
      <div class="face">
        <Icon id="ui-advisor" size={36} />
      </div>
      {about ? (
        <Button
          class={cx(look, 'link')}
          title="Show me"
          onPress={() => {
            hud.show(about);
          }}
        >
          {body}
        </Button>
      ) : (
        <p class={look}>{body}</p>
      )}
    </div>
  );
}
