// Chips naming treatments.

import './QualChips.css';

import { MODALITIES, type Modality } from '../../../core/data';

/** Chips naming the treatments someone is qualified in. */
export function QualChips({ quals }: { quals: readonly Modality[] }) {
  if (!quals.length) return null;
  return (
    <div class="quals">
      {quals.map((m) => (
        <span key={m} title={MODALITIES[m].name}>{`${MODALITIES[m].icon} ${MODALITIES[m].name}`}</span>
      ))}
    </div>
  );
}
