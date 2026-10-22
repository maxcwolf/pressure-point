// Chips naming treatments.

import './QualChips.css';

import { GENERAL_COURSES, type GeneralId, MODALITIES, type Modality } from '../../../core/data';
import { IconText } from './Icon';

/** Chips naming the treatments someone is qualified in, and the general courses they have passed. */
export function QualChips({ quals, general = [] }: { quals: readonly Modality[]; general?: readonly GeneralId[] }) {
  if (!quals.length && !general.length) return null;
  return (
    <div class="quals">
      {quals.map((m) => (
        <span key={m} title={MODALITIES[m].name}>
          <IconText id={MODALITIES[m].icon}>{MODALITIES[m].name}</IconText>
        </span>
      ))}
      {general.map((g) => (
        <span key={g} class="general" title={GENERAL_COURSES[g].desc}>
          <IconText id={GENERAL_COURSES[g].icon}>{GENERAL_COURSES[g].name}</IconText>
        </span>
      ))}
    </div>
  );
}
