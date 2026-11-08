// Chips naming someone's quirks and perks, and on an applicant's card and in the inspector, what each one does.

import { type PerkId, perkOf, type TraitId, traitOf } from '../../../core/data';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { rareFirst } from '../../lib/quirks';

/**
 * A quirk's chip: green where it helps, red where it costs, gold with a star for a rare one, which is ringed. Every chip
 * has the ring's room, clear where it has none, so a row with a rare chip stands no taller than one without.
 */
const chip = css({
  display: 'inline-block',
  fontSize: '12',
  fontWeight: 'bold',
  border: 'outline.thin',
  borderColor: 'transparent',
  borderRadius: '8',
  py: '0',
  px: '4',
  whiteSpace: 'nowrap',
  '&.good': { bg: 'good.bg', color: 'good' },
  '&.bad': { bg: 'bad.bg', color: 'bad' },
  '&.rare': { bg: 'highlight.bg', color: 'warn', borderColor: 'highlight' },
  '&.perk': { bg: 'info.bg', color: 'info', borderColor: 'info.light' },
});

/** The chips in a row, as on a row of the Staff menu. */
const row = css({ display: 'flex', flexWrap: 'wrap', gap: '4', m: '0', mt: '2' });

/** The quirks one to a line, each chip followed by what it does in plain words. */
const lines = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  m: '0',
  mt: '2',
  fontSize: '12',
  fontWeight: 'regular',
  lineHeight: 'snug',
  '& .chip': { mr: '4' },
});

/** The word that marks a rare quirk, between its chip and what it does. */
const rareWord = css({ fontSize: '12', fontWeight: 'bold', color: 'warn' });

/** The chip for one quirk, with what it does as its tooltip unless that is written out beside it (`spelled`). */
function Chip({ id, spelled = false }: { id: TraitId; spelled?: boolean }) {
  const def = traitOf(id);
  return (
    <span
      class={cx('quirk', 'chip', def.rare ? 'rare' : def.bad ? 'bad' : 'good', chip)}
      title={spelled ? undefined : def.desc}
    >
      {def.rare ? `★ ${def.name}` : def.name}
    </span>
  );
}

/** The chip for a perk, blue and ringed, with what it does as its tooltip unless that is written out beside it. */
function PerkChip({ id, spelled = false }: { id: PerkId; spelled?: boolean }) {
  const def = perkOf(id);
  return (
    <span class={cx('perk', 'chip', chip)} title={spelled ? undefined : def.desc}>
      {`◆ ${def.name}`}
    </span>
  );
}

/** The word that marks a perk brought from someone's last job, between its chip and what it does. */
const broughtWord = css({ fontSize: '12', fontWeight: 'bold', color: 'info' });

/**
 * Someone's perks as chips after their quirks, each with what it does on hover, or with `spell`, on a line of its own
 * with what it does after it, and for one they brought from their last job, a word saying so.
 */
export function PerkChips({
  perks,
  brought,
  spell = false,
}: {
  perks: readonly PerkId[];
  brought?: PerkId | undefined;
  spell?: boolean;
}) {
  if (!perks.length) return null;
  if (!spell)
    return (
      <div class={cx('perks', row)}>
        {perks.map((p) => (
          <PerkChip key={p} id={p} />
        ))}
      </div>
    );
  return (
    <div class={cx('perks', 'spelled', lines)}>
      {perks.map((p) => (
        <div key={p} class="perk-line">
          <PerkChip id={p} spelled />
          {p === brought && <span class={broughtWord}>{'from their last job\u00a0·\u00a0'}</span>}
          {perkOf(p).desc}
          {perkOf(p).joke && <em>{` ${perkOf(p).joke ?? ''}`}</em>}
        </div>
      ))}
    </div>
  );
}

/**
 * Someone's quirks as chips, rare ones first, each with what it does on hover. With `spell`, as on an applicant's card
 * and in the inspector, each is on a line of its own with what it does written after it, and no tooltip to say it
 * again; a row of the Staff menu keeps to the chips. Nobody hired since every applicant has a quirk can have none; someone from an older game can, and
 * shows no chips.
 */
export function QuirkChips({ traits, spell = false }: { traits: readonly TraitId[]; spell?: boolean }) {
  const ordered = rareFirst(traits);
  if (!ordered.length) return null;
  if (!spell)
    return (
      <div class={cx('quirks', row)}>
        {ordered.map((t) => (
          <Chip key={t} id={t} />
        ))}
      </div>
    );
  return (
    <div class={cx('quirks', 'spelled', lines)}>
      {ordered.map((t) => (
        <div key={t} class="quirk-line">
          <Chip id={t} spelled />
          {/* the word and its dot are held to the first word of what it does, so they never end a line alone */}
          {traitOf(t).rare && <span class={rareWord}>{'rare\u00a0·\u00a0'}</span>}
          {traitOf(t).desc}
        </div>
      ))}
    </div>
  );
}
