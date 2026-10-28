// Chips naming someone's quirks, and on an applicant's card and in the inspector, what each one does.

import { type TraitId, traitOf } from '../../../core/data';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';

/** A quirk's chip: green where it helps, red where it costs, gold with a star for a rare one. */
const chip = css({
  display: 'inline-block',
  fontSize: '12',
  fontWeight: 'bold',
  borderRadius: '8',
  py: '0',
  px: '6',
  whiteSpace: 'nowrap',
  cursor: 'help',
  '&.good': { bg: 'good.bg', color: 'good' },
  '&.bad': { bg: 'bad.bg', color: 'bad' },
  '&.rare': { bg: 'highlight.bg', color: 'warn', border: 'outline.thin', borderColor: 'highlight' },
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

/** The chip for one quirk, with what it does as its tooltip. */
function Chip({ id }: { id: TraitId }) {
  const def = traitOf(id);
  return (
    <span class={cx('quirk', 'chip', def.rare ? 'rare' : def.bad ? 'bad' : 'good', chip)} title={def.desc}>
      {def.rare ? `★ ${def.name}` : def.name}
    </span>
  );
}

/**
 * Someone's quirks as chips, rare ones first, each with what it does on hover. With `spell`, as on an applicant's card
 * and in the inspector, each is on a line of its own with what it does written after it; a row of the Staff menu keeps
 * to the chips. Nobody hired since every applicant has a quirk can have none; someone from an older game can, and
 * shows no chips.
 */
export function QuirkChips({ traits, spell = false }: { traits: readonly TraitId[]; spell?: boolean }) {
  const ordered = [...traits.filter((t) => traitOf(t).rare), ...traits.filter((t) => !traitOf(t).rare)];
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
          <Chip id={t} />
          {/* the dot is kept with the word, so neither starts a line alone */}
          {traitOf(t).rare && <span class={rareWord}>{'rare · '}</span>}
          {traitOf(t).desc}
        </div>
      ))}
    </div>
  );
}
