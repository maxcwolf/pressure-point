// Right side: a downloaded update, raise requests and promotions waiting on an answer, then messages, newest first, that
// fade once there has been time to read them. Past the first few they pile up underneath, to open out or dismiss at
// once. One about someone or something takes you there when clicked. While the inspector is open the newest two show
// above it in a band of their own, the rest counted, so the inspector keeps its place.

import './Toasts.css';

import { useGame, useHud } from '../hooks/use-hud';
import type { Toast } from '../hud';
import { cx } from '../lib/cx';
import { pileUp } from '../lib/messages';
import { promotionRequests, raiseRequests } from '../lib/status';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { inspecting } from './inspector/Inspector';

/** How many messages show above an open inspector. */
const STRIP = 2;

/** Raise requests and promotions still waiting, and the messages on screen with any piled under them. */
export function Toasts() {
  const hud = useHud();
  const game = useGame();
  const { sim, update } = game;
  const version = update?.ready();
  const { shown, piled } = pileUp(hud.toasts);
  const open = hud.toastsOpen;
  if (!open && inspecting(game)) {
    const requests = (version ? 1 : 0) + raiseRequests(sim.s.staff).length + promotionRequests(sim.s.staff).length;
    return <Strip newest={[...shown, ...piled]} requests={requests} />;
  }
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
      {(open || piled.length > 0) && <Pile piled={piled} open={open} />}
    </div>
  );
}

/**
 * Over an open inspector: the newest two messages, and a count of the rest with the requests waiting, its warnings in
 * red, that opens every one out when pressed.
 */
function Strip({ newest, requests }: { newest: Toast[]; requests: number }) {
  const hud = useHud();
  const hold = useHold();
  const rest = newest.slice(STRIP);
  const more = rest.length + requests;
  const warnings = rest.filter((t) => t.kind === 'bad').length;
  return (
    <div id="toasts" class="strip">
      <div class="messages">
        {newest.slice(0, STRIP).map((t) => (
          <Message key={t.id} toast={t} />
        ))}
      </div>
      {more > 0 && (
        <div class="pile" {...hold}>
          <div class="toast face">
            <Button
              class="words link"
              title="Show them all"
              onPress={() => {
                hud.openToasts(true, true);
              }}
            >
              {`${more} more`}
              {warnings > 0 && <b class="warnings">{` · ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`}</b>}
              <span class="chevron">▾</span>
            </Button>
          </div>
        </div>
      )}
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
