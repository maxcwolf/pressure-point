// A box to tell the developer what the player thinks, on the title screen and from the pause menu.

import './FeedbackPanel.css';

import { useState } from 'preact/hooks';

import { type FeedbackFrom, feedbackSends, sendFeedback } from '../../app/feedback';
import { cx } from '../lib/cx';

/** The most a player can write, which is plenty for a bug report and keeps one paste from being a whole log. */
const MAX_LENGTH = 4000;

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
      <div class="feedback">
        <p class="feedback-note">Thank you! Every message is read, and a lot of them turn into the next update.</p>
        <button
          class="feedback-again"
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
    <div class="feedback">
      <p class="feedback-intro">
        A bug, something confusing, an idea, or what you enjoyed: it all helps shape the game while it is in alpha.
      </p>
      <textarea
        class="feedback-message"
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
        class="feedback-email"
        type="email"
        aria-label="Your email, if you would like an answer"
        placeholder="Email, if you would like an answer (optional)"
        value={email}
        onInput={(e) => {
          setEmail(e.currentTarget.value);
        }}
      />
      {sending === 'failed' && (
        <p class={cx('feedback-note', 'bad')} role="alert">
          {feedbackSends
            ? 'It did not send. Check your connection and try again: what you wrote is still here.'
            : 'This copy of the game is a local build, which sends nothing.'}
        </p>
      )}
      <button class="go feedback-send" disabled={!ready} onClick={send}>
        {sending === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
      <p class="feedback-small">Sent with the game’s version and where you are in it. Nothing else about you.</p>
    </div>
  );
}
