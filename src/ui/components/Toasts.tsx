// Right side: a downloaded update, a card for the raises and one for the promotions waiting on an answer, then messages,
// newest first, that
// fade once there has been time to read them. Past the first few they pile up underneath, to open out or dismiss at
// once. One about someone or something takes you there when clicked. While the inspector is open the newest two show
// above it in a band of their own, the rest counted, so the inspector keeps its place.

import type { StaffRequest } from '../../core/sim/events';
import type { Staff } from '../../core/state/types';
import { css } from '../../styled-system/css';
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

/**
 * The column of cards. `messages`, `words` and `pile` are its parts' class names, for these rules and for the
 * end-to-end tests to find them by.
 */
const column = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
  // opened out, the messages scroll in the room down to the bar at the bottom, over the inspector
  '&.open': { position: 'absolute', inset: '[0 0 14px]', zIndex: 'above' },
  '&.open .messages': {
    minH: '[0]',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    pointerEvents: 'auto',
    // room for the last message's shadow
    pb: '4',
  },
  // over an open inspector, the newest two in a band of their own, each cut to two lines, and a count of the rest, so
  // the inspector keeps its place whatever comes in
  '&.strip': { flex: 'none', h: '[170px]', overflow: 'hidden' },
  // Panda's lineClamp sets the -webkit-box display, its vertical orientation and the hidden overflow it needs
  '&.strip .messages .words': { lineClamp: '2', pb: '0', mb: '8' },
  '&.strip .pile': { mb: '0' },
});

/** The messages, newest first. */
const messages = css({ display: 'flex', flexDirection: 'column', gap: '8' });

/** A card: cream, with a thick edge down its left in its color, sliding in, and fading once it is on its way out. */
const card = css.raw({
  bg: 'bg.panel',
  border: 'outline.thick',
  borderLeftWidth: 'stripe',
  borderRadius: '12',
  py: '8',
  px: '12',
  fontSize: '14',
  boxShadow: 'raised',
  animation: 'slide 0.3s ease-out',
  transition: '[opacity 0.4s]',
});

/**
 * A card waiting on an answer, a downloaded update or the staff asking for something, in gold and with no slide, a
 * click to it: it lifts a little under the pointer, and ends with an arrow.
 */
const requestCard = css(card, {
  borderLeftColor: 'highlight',
  animation: 'none',
  pointerEvents: 'auto',
  textAlign: 'left',
  font: 'inherit',
  fontSize: '14',
  _hover: { filter: '[brightness(1.04)]', transform: '[translateY(-1px)]' },
  '&::after': { content: "' ›'", fontWeight: 'heavy', opacity: 'faint' },
});

/**
 * A message: its words, then its close button at the right; its edge green for good news, red for bad and blue for
 * neither.
 */
const message = css(card, {
  display: 'flex',
  alignItems: 'flex-start',
  py: '0',
  pl: '0',
  pr: '4',
  pointerEvents: 'auto',
  '&.good': { borderLeftColor: 'good.solid' },
  '&.bad': { borderLeftColor: 'bad.solid' },
  '&.info': { borderLeftColor: 'info.solid' },
  '&.out': { opacity: 'hidden' },
});

/** The people asking on a card for several, in a list under it, each a click to them. */
const requestList = css({
  m: '10',
  mt: '[-4px]',
  mb: '0',
  py: '6',
  px: '4',
  listStyle: 'none',
  bg: 'bg.panel',
  border: 'outline.thin',
  borderTop: 'none',
  borderRadius: '[0 0 10px 10px]',
  pointerEvents: 'auto',
});

/** One of them, by name. */
const requestName = css({
  display: 'block',
  w: '[100%]',
  py: '2',
  px: '8',
  border: 'none',
  borderRadius: '6',
  bg: '[none]',
  textAlign: 'left',
  fontSize: '14',
  fontWeight: 'bold',
  _hover: { bg: 'bg.inset' },
});

/** A message's words, taking the room beside its close button. */
const wordsStyle = css({ flex: '1', minW: '[0]', p: '8', pr: '4', pl: '12' });

/** Words that are a click to what they are about. */
const wordsLink = css({
  border: 'none',
  bg: '[none]',
  color: 'inherit',
  pointerEvents: 'auto',
  textAlign: 'left',
  font: 'inherit',
  fontSize: '14',
});

/** How many times a message has come up, on a faint tag after it. */
const countTag = css({
  ml: '6',
  py: '0',
  px: '6',
  borderRadius: '8',
  bg: 'bg.muted',
  fontSize: '12',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
});

/** A faint round close button, which shows itself under the pointer. */
const close = css({
  flex: 'none',
  w: '[24px]',
  h: '[24px]',
  mt: '4',
  border: 'none',
  borderRadius: 'disc',
  bg: '[none]',
  fontSize: '12',
  opacity: 'faint',
  _hover: { opacity: 'full', bg: 'bg.muted' },
});

/** The messages past the first few: a pile of cards, the next ones down peeking out under its face in their colors. */
const pile = css({ position: 'relative', flex: 'none', mb: '14', '&.open': { mb: '0' } });

/**
 * A card peeking out under the pile's face, in the color of the message it stands for; the deepest casts the pile's
 * shadow.
 */
const sheet = css({
  position: 'absolute',
  inset: '[7px 6px -7px]',
  bg: 'bg.inset',
  border: 'outline.thick',
  borderRadius: '12',
  '&.deep': { inset: '[14px 12px -14px]', boxShadow: 'raised' },
  '&.good': { bg: 'good.solid' },
  '&.bad': { bg: 'bad.solid' },
  '&.info': { bg: 'info.solid' },
});

/**
 * The pile's face: a card laid out as a message's, in bold, that does not slide in, and with no shadow of its own while
 * the sheets are under it.
 */
const face = css(card, {
  display: 'flex',
  alignItems: 'flex-start',
  py: '0',
  pl: '0',
  pr: '4',
  pointerEvents: 'auto',
  position: 'relative',
  fontWeight: 'bold',
  animation: 'none',
  '.pile:not(.open) &': { boxShadow: 'none' },
});

/** The chevron after the pile's words, saying it opens out or folds up. */
const chevron = css({ ml: '6', opacity: 'quiet' });

/** The count of warnings among the rest, in red. */
const warningCount = css({ color: 'bad' });

/** Raise requests and promotions still waiting, and the messages on screen with any piled under them. */
export function Toasts() {
  const hud = useHud();
  const game = useGame();
  const { sim, update } = game;
  const version = update?.ready();
  const { shown, piled } = pileUp(hud.toasts);
  const open = hud.toastsOpen;
  if (!open && inspecting(game)) {
    const requests = [version, raiseRequests(sim.s.staff)[0], promotionRequests(sim.s.staff)[0]].filter(Boolean).length;
    return <Strip newest={[...shown, ...piled]} requests={requests} />;
  }
  return (
    <div id="toasts" class={cx(column, open && 'open')}>
      {version && (
        <Button
          key="update"
          class={cx('toast', 'request', requestCard)}
          title="Restart to update"
          onPress={() => {
            hud.open('update');
          }}
        >
          <IconText id="ui-update">{`Version ${version} is ready to install`}</IconText>
        </Button>
      )}
      <RequestCard which="raise" staff={raiseRequests(sim.s.staff)} />
      <RequestCard which="promotion" staff={promotionRequests(sim.s.staff)} />
      <div class={cx('messages', messages)}>
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
    <div id="toasts" class={cx(column, 'strip')}>
      <div class={cx('messages', messages)}>
        {newest.slice(0, STRIP).map((t) => (
          <Message key={t.id} toast={t} />
        ))}
      </div>
      {more > 0 && (
        <div class={cx('pile', pile)} {...hold}>
          <div class={cx('toast', face)}>
            <Button
              class={cx('words', wordsStyle, wordsLink)}
              title="Show them all"
              onPress={() => {
                hud.openToasts(true, true);
              }}
            >
              {`${more} more`}
              {warnings > 0 && (
                <b class={warningCount}>{` · ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`}</b>
              )}
              <span class={chevron}>▾</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** How each card for the staff asking for something reads, for one of them and for several. */
const REQUEST_CARDS = {
  raise: { icon: 'bubble-raise', one: 'wants a raise', many: 'want a raise' },
  promotion: { icon: 'ui-upgrade', one: 'is ready for promotion', many: 'are ready for promotion' },
} as const;

/**
 * One card for everyone asking for a raise, or for a promotion, which stays until each is answered: "Ines Crickmore and
 * 2 more want a raise". For one, it takes you to them; for several, it opens a list of them under it to pick from, each
 * with what they said in its tooltip.
 */
function RequestCard({ which, staff }: { which: StaffRequest; staff: readonly Staff[] }) {
  const hud = useHud();
  const [first] = staff;
  if (!first) return null;
  const { icon, one, many } = REQUEST_CARDS[which];
  const open = hud.requestsOpen === which && staff.length > 1;
  /** Take the player to someone asking. */
  const show = (st: Staff) => {
    hud.show({ kind: 'staff', id: st.id });
  };
  return (
    <>
      <Button
        class={cx('toast', 'request', requestCard, open && 'open')}
        title={staff.length === 1 ? 'Show me' : open ? 'Hide the list' : 'Show who'}
        onPress={() => {
          if (staff.length === 1) show(first);
          else hud.toggleRequests(which);
        }}
      >
        <IconText id={icon}>
          {staff.length === 1 ? `${first.name} ${one}` : `${first.name} and ${staff.length - 1} more ${many}`}
        </IconText>
      </Button>
      {open && (
        <ul class={requestList}>
          {staff.map((st) => (
            <li key={st.id}>
              <Button
                class={requestName}
                title={hud.asked.get(st.id) ?? `${st.name} ${one}`}
                onPress={() => {
                  show(st);
                }}
              >
                {st.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
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
      {t.count > 1 && <b class={countTag}>{`×${t.count}`}</b>}
    </>
  );
  return (
    <div class={cx('toast', message, t.kind, t.leaving && 'out')} {...hold}>
      {about ? (
        <Button
          class={cx('words', wordsStyle, wordsLink)}
          title="Show me"
          onPress={() => {
            hud.show(about);
          }}
        >
          {words}
        </Button>
      ) : (
        <span class={cx('words', wordsStyle)}>{words}</span>
      )}
      <Button
        class={close}
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
    <div class={cx('pile', pile, open && 'open')} {...hold}>
      {/* the deeper sheet first, so the nearer one is drawn over it */}
      {!open && piled[1] && <div class={cx(sheet, 'deep', piled[1].kind)} />}
      {!open && piled[0] && <div class={cx(sheet, piled[0].kind)} />}
      <div class={cx('toast', face)}>
        <Button
          class={cx('words', wordsStyle, wordsLink)}
          title={open ? 'Show only the newest' : 'Show them all'}
          onPress={() => {
            hud.openToasts(!open);
          }}
        >
          {open ? 'Show fewer' : `${count} more ${count === 1 ? 'message' : 'messages'}`}
          <span class={chevron}>{open ? '▴' : '▾'}</span>
        </Button>
        <Button
          class={close}
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
