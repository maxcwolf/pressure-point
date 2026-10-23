// Right side: a downloaded update, raise requests and promotions waiting on an answer, then messages, newest first, that
// fade once there has been time to read them. Past the first few they pile up underneath, to open out or dismiss at
// once. One about someone or something takes you there when clicked.

import './Toasts.css';

import { useGame, useHud } from '../hooks/use-hud';
import type { Toast } from '../hud';
import { cx } from '../lib/cx';
import { pileUp } from '../lib/messages';
import { promotionRequests, raiseRequests } from '../lib/status';
import { Button } from './common/Button';
import { IconText } from './common/Icon';

/** Raise requests and promotions still waiting, and the messages on screen with any piled under them. */
export function Toasts() {
  const hud = useHud();
  const { sim, update } = useGame();
  const version = update?.ready();
  const { shown, piled } = pileUp(hud.toasts);
  const open = hud.toastsOpen && piled.length > 0;
  return (
    <div id="toasts" class={cx(open && 'open')}>
      {version && (
        <Button
          key="update"
          class="toast request link"
          title="Restart to update"
          onPress={() => {
            hud.open('update');
          }}
        >
          <IconText id="ui-update">{`Version ${version} is ready to install`}</IconText>
        </Button>
      )}
      {raiseRequests(sim.s.staff).map((st) => (
        <Button
          key={`raise-${st.id}`}
          class="toast request link"
          title="Show me"
          onPress={() => {
            hud.show({ kind: 'staff', id: st.id });
          }}
        >
          <IconText id="bubble-raise">{`${st.name} wants a raise`}</IconText>
        </Button>
      ))}
      {promotionRequests(sim.s.staff).map((st) => (
        <Button
          key={`promote-${st.id}`}
          class="toast request link"
          title="Show me"
          onPress={() => {
            hud.show({ kind: 'staff', id: st.id });
          }}
        >
          <IconText id="ui-upgrade">{`${st.name} is ready for promotion`}</IconText>
        </Button>
      ))}
      <div class="messages">
        {(open ? [...shown, ...piled] : shown).map((t) => (
          <Message key={t.id} toast={t} />
        ))}
      </div>
      {piled.length > 0 && <Pile piled={piled} open={open} />}
    </div>
  );
}

/** Hold the messages' clock while the pointer is on this. */
function useHold() {
  const hud = useHud();
  return {
    /** The pointer has come onto it. */
    onPointerEnter: () => {
      hud.holdToasts(true);
    },
    /** The pointer has gone off it. */
    onPointerLeave: () => {
      hud.holdToasts(false);
    },
  };
}

/** A message, how many times it has come up, and its close button. */
function Message({ toast: t }: { toast: Toast }) {
  const hud = useHud();
  const hold = useHold();
  const about = t.about;
  const words = (
    <>
      {t.icon ? <IconText id={t.icon}>{t.text}</IconText> : t.text}
      {t.count > 1 && <b class="count">{`×${t.count}`}</b>}
    </>
  );
  return (
    <div class={cx('toast', t.kind, t.leaving && 'out')} {...hold}>
      {about ? (
        <Button
          class="words link"
          title="Show me"
          onPress={() => {
            hud.show(about);
          }}
        >
          {words}
        </Button>
      ) : (
        <span class="words">{words}</span>
      )}
      <Button
        class="close"
        title="Dismiss"
        onPress={() => {
          hud.dismissToast(t.id);
        }}
      >
        ✕
      </Button>
    </div>
  );
}

/**
 * The messages past the first few, drawn as a pile of cards with the next ones down peeking out under it in their
 * colors. Pressed, it opens every message out, or folds them back up; its close button asks before dismissing them all.
 */
function Pile({ piled, open }: { piled: Toast[]; open: boolean }) {
  const hud = useHud();
  const hold = useHold();
  const count = piled.length;
  return (
    <div class={cx('pile', open && 'open')} {...hold}>
      {/* the deeper sheet first, so the nearer one is drawn over it */}
      {!open && piled[1] && <div class={cx('sheet deep', piled[1].kind)} />}
      {!open && piled[0] && <div class={cx('sheet', piled[0].kind)} />}
      <div class="toast face">
        <Button
          class="words link"
          title={open ? 'Show only the newest' : 'Show them all'}
          onPress={() => {
            hud.openToasts(!open);
          }}
        >
          {open ? 'Show fewer' : `${count} more ${count === 1 ? 'message' : 'messages'}`}
          <span class="chevron">{open ? '▴' : '▾'}</span>
        </Button>
        <Button
          class="close"
          title="Dismiss all messages"
          onPress={() => {
            hud.open('confirm-dismiss');
          }}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
