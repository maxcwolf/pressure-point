// Chips naming someone's quirks.

import { type TraitId, traitOf } from '../../../core/data';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';

/** The row of chips: green where a quirk helps, red where it costs, gold for a rare one. */
const chips = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4',
  m: '0',
  mt: '2',
  '& > span': {
    fontSize: '12',
    fontWeight: 'bold',
    borderRadius: '8',
    py: '0',
    px: '6',
    whiteSpace: 'nowrap',
    cursor: 'help',
  },
  '& > .good': { bg: 'good.bg', color: 'good' },
  '& > .bad': { bg: 'bad.bg', color: 'bad' },
  '& > .rare': { bg: 'highlight.bg', color: 'warn', border: 'outline.thin', borderColor: 'highlight' },
});

/** A rare quirk spelled out: its name in gold, and what it does under it. */
const rareCard = css({
  display: 'block',
  fontSize: '12',
  lineHeight: 'snug',
  bg: 'highlight.bg',
  color: 'warn',
  border: 'outline.thin',
  borderColor: 'highlight',
  borderRadius: '8',
  py: '2',
  px: '6',
  mt: '2',
  '& b': { fontWeight: 'bold', fontSize: '12' },
  '& span': { display: 'block' },
});

/**
 * Someone's quirks as chips, each with what it does on hover. With `spell`, a rare quirk is spelled out above the
 * rest, as it is on an applicant's card and in the inspector; a row keeps it to a gold chip. Nobody hired since every
 * applicant has a quirk can have none; someone from an older game can, and shows no chips.
 */
export function QuirkChips({ traits, spell = false }: { traits: readonly TraitId[]; spell?: boolean }) {
  const rare = traits.filter((t) => traitOf(t).rare);
  const common = traits.filter((t) => !traitOf(t).rare);
  const chipped = spell ? common : [...rare, ...common];
  return (
    <>
      {spell &&
        rare.map((t) => (
          <span key={t} class={cx('quirk', 'rare', rareCard)}>
            <b>{`★ ${traitOf(t).name} · rare`}</b>
            <span>{traitOf(t).desc}</span>
          </span>
        ))}
      {chipped.length > 0 && (
        <div class={cx('quirks', chips)}>
          {chipped.map((t) => {
            const def = traitOf(t);
            return (
              <span key={t} class={cx('quirk', def.rare ? 'rare' : def.bad ? 'bad' : 'good')} title={def.desc}>
                {def.rare ? `★ ${def.name}` : def.name}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
