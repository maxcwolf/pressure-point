// Decorating a room from its inspector: a swatch for each floor and wall, the locked ones offered for karma, and a
// way to give every room of its kind the same look.

import { decorOpen } from '../../../core/campaign';
import {
  type DecorDef,
  type DecorKey,
  FLOOR_ORDER,
  type FloorId,
  FLOORS,
  ROOMS,
  WALL_ORDER,
  type WallId,
  WALLS,
} from '../../../core/data';
import { unlockedUpTo } from '../../../core/state/game';
import type { Room } from '../../../core/state/types';
import { loadCampaign } from '../../../storage/campaign';
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { karmaText } from '../../lib/karma';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';

/**
 * Decorating a room: a row of swatches for the floor and one for the walls, under a dashed line, with a heading a
 * little bigger than the inspector's others (under `.insp`, to outdo them).
 */
const decorCard = css({
  mt: '10',
  borderTop: 'divider.dashed',
  pt: '6',
  '.insp &': { '& h4': { fontSize: '14', fontWeight: 'bold' } },
});

/** What the floor or the walls are now, close over their swatches (under `.insp`, to outdo its paragraphs' spacing). */
const row = css({ '.insp &': { m: '0', mt: '4' } });

/** A row of swatches. */
const swatches = css({ display: 'flex', flexWrap: 'wrap', gap: '4', m: '0', mt: '2', mb: '6' });

/**
 * One floor's or wall's swatch: a small square of it in a frame, ringed in teal while it is the one laid, and faded
 * while only karma unlocks it.
 */
const swatch = css({
  position: 'relative',
  w: '[24px]',
  h: '[24px]',
  p: '2',
  border: 'card',
  borderRadius: '8',
  bg: 'bg.card',
  '& i': { display: 'block', w: '[100%]', h: '[100%]', borderRadius: '4' },
  _on: { borderColor: 'accent.strong', boxShadow: '[0 0 0 2px {colors.accent}]' },
  '&.karma i': { opacity: '[0.6]' },
});

/** A small lock in the corner of a swatch that karma unlocks. */
const lock = css({
  position: 'absolute',
  right: '[-5px]',
  bottom: '[-5px]',
  display: 'flex',
  bg: 'bg.card',
  borderRadius: 'disc',
  p: '[1px]',
});

/** The button to give every room of its kind the same look. */
const decorAll = css({
  border: 'outline',
  borderRadius: '12',
  py: '4',
  px: '10',
  fontWeight: 'bold',
  fontSize: '13',
  bg: 'control',
  boxShadow: '[0 3px 0 {colors.shadow}]',
  m: '0',
  mt: '2',
  mb: '6',
});

/** One row of swatches: the floors or the walls, the room's own picked out, the locked ones marked with their price. */
function Swatches<Id extends string>({
  part,
  order,
  defs,
  current,
  open,
  onPick,
  onLocked,
}: {
  part: 'floor' | 'wall';
  order: readonly Id[];
  defs: Readonly<Record<Id, DecorDef<Id>>>;
  current: Id;
  open: (key: DecorKey) => boolean;
  onPick: (id: Id) => void;
  onLocked: (key: DecorKey) => void;
}) {
  const label = part === 'floor' ? 'Floor' : 'Walls';
  return (
    <>
      <p class={cx('sub', row)}>{`${label}: ${defs[current].name}`}</p>
      <div class={swatches} aria-label={label}>
        {order.map((id) => {
          const def = defs[id];
          const key = `${part}:${id}` as DecorKey;
          const locked = !open(key);
          return (
            <Button
              key={id}
              class={cx(swatch, current === id && 'on', locked && 'karma')}
              title={locked ? `${def.name}: unlock for ${karmaText(def.karma ?? 0)}` : def.name}
              onPress={() => {
                if (locked) onLocked(key);
                else onPick(id);
              }}
            >
              <i style={{ background: def.swatch }} />
              {locked && (
                <span class={lock} aria-hidden="true">
                  <Icon id="ui-lock" size={12} />
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </>
  );
}

/** The room's floor and walls to choose from, and a button to decorate every room of its kind the same. */
export function DecorPicker({ room }: { room: Room }) {
  const hud = useHud();
  const { sim } = useGame();
  const upTo = unlockedUpTo(sim.s);
  const { decor } = loadCampaign();
  /** Whether a floor or wall can be chosen in this game. */
  const open = (key: DecorKey) => decorOpen(key, upTo, decor);
  /** Offer a locked floor or wall for karma, to be put straight down in this room once unlocked. */
  const offer = (key: DecorKey) => {
    hud.karmaItem = null;
    hud.karmaDecor = { key, roomId: room.id };
    hud.open('karma');
  };
  const floor: FloorId = room.floor ?? 'standard';
  const wall: WallId = room.wall ?? 'standard';
  const name = ROOMS[room.type].name;
  return (
    // `decor` is for the end-to-end tests to find it by
    <div class={cx('decor', decorCard)}>
      <h4>Decorate</h4>
      <Swatches
        part="floor"
        order={FLOOR_ORDER}
        defs={FLOORS}
        current={floor}
        open={open}
        onLocked={offer}
        onPick={(id) => sim.decorateRoom(room.id, { floor: id })}
      />
      <Swatches
        part="wall"
        order={WALL_ORDER}
        defs={WALLS}
        current={wall}
        open={open}
        onLocked={offer}
        onPick={(id) => sim.decorateRoom(room.id, { wall: id })}
      />
      <Button
        class={decorAll}
        title={`Give every ${name} this floor and these walls, and new ones too`}
        onPress={() => {
          sim.decorateRoom(room.id, {}, true);
          hud.toast(`Every ${name} now looks like this one, and new ones will too.`, 'good');
        }}
      >
        <IconText id="ui-paint">{`Use for every ${name}`}</IconText>
      </Button>
    </div>
  );
}
