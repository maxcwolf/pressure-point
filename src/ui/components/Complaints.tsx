// The complaints guests have left, each with what went wrong and, while it is open, Make it right and a way to let it
// go: under their card at the side, and in the Reception Desk's inspector.

import type { Complaint } from '../../core/state/types';
import { css } from '../../styled-system/css';
import { goButton } from '../../styled-system/recipes';
import { useGame } from '../hooks/use-hud';
import { complaintNote, complaintSaid, makeItRightNote } from '../lib/complaints';
import { cx } from '../lib/cx';
import { Button } from './common/Button';
import { smallButton } from './inspector/looks';

/** The list: one complaint to a row, each row a line between it and the next. */
const list = css({
  m: '0',
  p: '0',
  listStyle: 'none',
  '& > li + li': { borderTop: 'outline.thin', mt: '6', pt: '6' },
});

/** What went wrong, and below it where it stands. */
const said = css({ display: 'block', fontSize: '14', '& small': { display: 'block', opacity: 'muted' } });

/** Make it right and the ✕ beside it. */
const answers = css({ display: 'flex', alignItems: 'center', gap: '6' });

/** The ✕ that lets a complaint go: a small round button. */
const letGo = css({ px: '8' });

/** Each complaint, with its answers while it is still open. */
export function ComplaintList({ complaints }: { complaints: readonly Complaint[] }) {
  const { sim } = useGame();
  return (
    // `complaints`, `make-it-right` and `let-go` are for the end-to-end tests to find them by
    <ul class={cx('complaints', list)}>
      {complaints.map((c) => (
        <li key={c.id}>
          <span class={said}>
            {complaintSaid(c)}
            <small>{complaintNote(c, sim.s.day)}</small>
          </span>
          {c.due === undefined && (
            <span class={answers}>
              <Button
                class={cx(smallButton, goButton(), 'make-it-right')}
                title={makeItRightNote(c)}
                onPress={() => {
                  sim.answerComplaint(c.id);
                }}
              >
                Make it right
              </Button>
              <Button
                class={cx(smallButton, letGo, 'let-go')}
                title="Let it go"
                label={`Let ${c.name}'s complaint go`}
                onPress={() => {
                  sim.dropComplaint(c.id);
                }}
              >
                ✕
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
