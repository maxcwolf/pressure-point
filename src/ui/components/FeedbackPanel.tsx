// A box to tell the developer what the player thinks, on the title screen and from the pause menu.

import { useState } from 'preact/hooks';

import { type FeedbackFrom, feedbackSends, sendFeedback } from '../../app/feedback';
import { css } from '../../styled-system/css';
import { goButton } from '../../styled-system/recipes';
import { cx } from '../lib/cx';

/** The most a player can write, which is plenty for a bug report and keeps one paste from being a whole log. */
const MAX_LENGTH = 4000;

// The words keep their sizes in a dialog too, which draws its words larger.

/** The panel: one thing under another. */
const panel = css({ display: 'flex', flexDirection: 'column', gap: '8', m: '0', mt: '6', mb: '4', textAlign: 'left' });

/** What the box is for, over it. */
const intro = css({ fontSize: '15 !important' });

/** A box to type in. */
const field = css.raw({
  font: 'inherit',
  fontSize: '15',
  color: 'fg',
  bg: 'bg.card',
  border: 'outline',
  borderRadius: '12',
  py: '6',
  px: '12',
  userSelect: 'text',
  WebkitUserSelect: 'text',
  pointerEvents: 'auto',
});

/** The box for what the player thinks, a few lines tall and taller if they drag it. */
const messageBox = css(field, { resize: 'vertical', minH: '96' });
const emailBox = css(field);

/** Send, in green, or Send more, in the middle; faded while there is nothing to send. */
const button = css({
  pointerEvents: 'auto',
  alignSelf: 'center',
  border: 'outline',
  borderRadius: '12',
  py: '6',
  px: '16',
  fontSize: '15',
  fontWeight: 'bold',
  bg: 'control',
  color: 'fg',
  boxShadow: 'pressed',
  '&.go': { bg: 'go', color: 'fg.on-accent' },
  _disabled: { opacity: 'faint', cursor: 'default' },
});

/** Thanks once it has gone, in green, or why it did not, in red. */
const noteLook = css({
  fontSize: '14 !important',
  bg: 'good.bg',
  color: 'good',
  borderRadius: '10',
  py: '6',
  px: '10',
  '&.bad': { bg: 'bad.bg', color: 'bad' },
});

/** What goes with it, in small print under the button. */
const small = css({ fontSize: '12 !important', textAlign: 'center', opacity: 'muted' });

/** How far sending has got. */
type Sending = 'writing' | 'sending' | 'sent' | 'failed';

/** What the player can write, an email to be answered at, and a button to send them. */
export function FeedbackPanel({ from }: { from: FeedbackFrom }) {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState<Sending>('writing');
  const ready = message.trim() !== '' && sending !== 'sending';
  /** Send what was written, and clear it once it has gone. */
  const send = () => {
    if (!ready) return;
    setSending('sending');
    void sendFeedback(message.trim(), email.trim(), from).then((sent) => {
      setSending(sent ? 'sent' : 'failed');
      if (sent) setMessage('');
    });
  };
  if (sending === 'sent') {
    return (
      <div class={panel}>
        <p class={noteLook}>Thank you! Every message is read, and a lot of them turn into the next update.</p>
        <button
          class={button}
          onClick={() => {
            setSending('writing');
          }}
        >
          Send more
        </button>
      </div>
    );
  }
  return (
    <div class={panel}>
      <p class={intro}>
        A bug, something confusing, an idea, or what you enjoyed: it all helps shape the game while it is in alpha.
      </p>
      <textarea
        class={messageBox}
        aria-label="Your feedback"
        placeholder="What happened, or what would you like to see?"
        maxLength={MAX_LENGTH}
        rows={5}
        value={message}
        onInput={(e) => {
          setMessage(e.currentTarget.value);
        }}
      />
      <input
        class={emailBox}
        type="email"
        aria-label="Your email, if you would like an answer"
        placeholder="Email, if you would like an answer (optional)"
        value={email}
        onInput={(e) => {
          setEmail(e.currentTarget.value);
        }}
      />
      {sending === 'failed' && (
        <p class={cx(noteLook, 'bad')} role="alert">
          {feedbackSends
            ? 'It did not send. Check your connection and try again: what you wrote is still here.'
            : 'This copy of the game is a local build, which sends nothing.'}
        </p>
      )}
      <button class={cx(goButton(), button)} disabled={!ready} onClick={send}>
        {sending === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
      <p class={small}>Sent with the game’s version and where you are in it. Nothing else about you.</p>
    </div>
  );
}
