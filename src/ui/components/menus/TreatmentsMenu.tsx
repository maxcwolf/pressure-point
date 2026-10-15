// The Treatments menu: each discipline's modalities, and whether the center can deliver them.

import './TreatmentsMenu.css';

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
} from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { disciplineNote } from '../../lib/delivery';
import { kitNote } from '../../lib/mishaps';
import { restNote } from '../../lib/recovery';

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
  return (
    <div class={cx('card mod', locked && 'locked')}>
      <i>{def.icon}</i>
      <b>{def.name}</b>
      <p>{def.desc}</p>
      <p class="treats">{`Treats: ${treats}`}</p>
      {locked ? (
        <em>{`🔒 Unlocks at star ${def.star}`}</em>
      ) : (
        <>
          <em class={qualified ? 'ok' : 'warn'}>{`${qualified ? '✔' : '⚠️'} ${qualified} qualified`}</em>{' '}
          {note && <em class={note.ok ? 'ok' : 'warn'}>{note.text}</em>}{' '}
          {rest && <em class={rest.ok ? 'ok' : 'warn'}>{rest.text}</em>}{' '}
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
      <h4 class="section">{`${disc.icon} ${disc.name}`}</h4>
      <p class="sub">{note}</p>
      <div class="cards">
        {MODALITY_ORDER.filter((m) => MODALITIES[m].discipline === discipline).map((m) => (
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
    <div class="panel menu">
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
