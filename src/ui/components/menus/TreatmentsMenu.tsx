// The Treatments menu: each discipline's modalities, and whether the center can deliver them.

import {
  conditionHere,
  conditionOf,
  CONDITIONS,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  ITEMS,
  MISHAPS,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  roomHere,
  ROOMS,
} from '../../../core/data';
import { an, money } from '../../../core/format';
import { roomForModality } from '../../../core/sim/machines';
import { openedEarly } from '../../../core/sim/waves';
import { unlockedUpTo } from '../../../core/state/game';
import { css } from '../../../styled-system/css';
import { panelCard } from '../../../styled-system/recipes';
import { useGame } from '../../hooks/use-hud';
import { tripNote } from '../../lib/ceremonies';
import { cx } from '../../lib/cx';
import { disciplineNote } from '../../lib/delivery';
import { kitNote } from '../../lib/mishaps';
import { restNote } from '../../lib/recovery';
import { Icon, IconText, Line } from '../common/Icon';
import { cardLook, cards, menuPanel } from './looks';

/**
 * A modality's card, which is not pressed, so it keeps the plain pointer even while locked. What it treats, and where,
 * reads as plainly as its name.
 */
const modalityCard = css(cardLook, {
  cursor: 'default',
  _locked: { cursor: 'default' },
  '& .treats': { opacity: 'full', fontWeight: 'medium', mt: '2' },
  // balanced over its lines, so a narrow card does not leave the star's number on a line of its own
  '& em.early': { bg: 'warm.bg', color: 'fg', textWrap: 'balance' },
});

/** A discipline's heading, over its modalities. */
const section = css({ fontSize: '15', fontWeight: 'bold', m: '0', mt: '12', mb: '4' });

/** What a modality treats, who can give it and whether its equipment is in. */
function ModalityCard({ modality }: { modality: Modality }) {
  const { sim } = useGame();
  const s = sim.s;
  const def = MODALITIES[modality];
  const locked = !sim.unlocked(modality);
  const treats = CONDITIONS.filter((c) => c.modality === modality && conditionHere(c, s.center))
    .map((c) => `${c.name} (${money(c.fee)})`)
    .join(', ');
  const role = DISCIPLINES[def.discipline].role;
  const qualified = s.staff.filter(
    (x) => x.role === role && x.state !== 'leaving' && x.quals.includes(modality),
  ).length;
  const waiting = s.guests.filter((g) => g.goal === 'treat' && conditionOf(g.condition).modality === modality).length;
  const kit = def.equipment ? ITEMS[def.equipment] : null;
  const kits = s.items.filter((i) => i.type === def.equipment);
  const stoppedBy = s.mishap && kits.some((i) => sim.world.stoppedByMishap(i)) ? MISHAPS[s.mishap.kind] : undefined;
  const note =
    kit &&
    kitNote(
      kit.name,
      kits.some((i) => sim.world.usable(i)),
      stoppedBy,
    );
  const rest = restNote(def.rest, sim.hasRoom('recovery'));
  const trip = tripNote(def.trip);
  // opened early by an ailment going around, before its star
  const early = !locked && openedEarly(s, modality);
  return (
    <div class={cx('card', modalityCard, locked && 'locked')}>
      <Icon id={def.icon} size={34} />
      <b>{def.name}</b>
      <p>{def.desc}</p>
      <p class="treats">{`Treats: ${treats}`}</p>
      {def.machine && <p class="treats">{`Done in the ${ROOMS[roomForModality(modality)].name}`}</p>}
      {locked ? (
        <em>
          <IconText id="ui-lock">
            {def.machine && def.star <= unlockedUpTo(s)
              ? `Build ${an(ROOMS[roomForModality(modality)].name)} to offer it`
              : `Unlocks at star ${def.star}`}
          </IconText>
        </em>
      ) : (
        <>
          {early && (
            <em class="early">
              <IconText id="bubble-sick">{`Open early, before star ${def.star}`}</IconText>
            </em>
          )}{' '}
          <em class={qualified ? 'ok' : 'warn'}>
            {qualified ? `✔ ${qualified} qualified` : <IconText id="ui-warning">0 qualified</IconText>}
          </em>{' '}
          {note && (
            <em class={note.ok ? 'ok' : 'warn'}>
              <Line line={note} />
            </em>
          )}{' '}
          {rest && (
            <em class={rest.ok ? 'ok' : 'warn'}>
              <Line line={rest} />
            </em>
          )}{' '}
          {trip && (
            <em>
              <Line line={trip} />
            </em>
          )}{' '}
          <em>{`${waiting} waiting · ${def.seconds}s session`}</em>
        </>
      )}
    </div>
  );
}

/** One discipline's modalities, and what it takes to offer them. */
function DisciplineSection({ discipline }: { discipline: Discipline }) {
  const { sim } = useGame();
  const disc = DISCIPLINES[discipline];
  const note = disciplineNote(discipline, sim.hasRoom(disc.room), unlockedUpTo(sim.s));
  return (
    <>
      <h4 class={section}>
        <IconText id={disc.icon}>{disc.name}</IconText>
      </h4>
      <p class="sub">{note}</p>
      <div class={cards}>
        {MODALITY_ORDER.filter(
          (m) => MODALITIES[m].discipline === discipline && roomHere(ROOMS[roomForModality(m)], sim.s.center),
        ).map((m) => (
          <ModalityCard key={m} modality={m} />
        ))}
      </div>
    </>
  );
}

/** Every discipline that is switched on. */
export function TreatmentsMenu() {
  const { sim } = useGame();
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <h3>Treatments</h3>
      <p class="sub">
        A diagnosis prescribes a treatment. It works properly only with someone qualified in it and the right equipment
        in the room. Staff learn new ones in a Training Room. The harder ones leave guests needing a rest in a Recovery
        Lounge after.
      </p>
      {DISCIPLINE_ORDER.filter((d) => sim.enabled(d)).map((d) => (
        <DisciplineSection key={d} discipline={d} />
      ))}
    </div>
  );
}
