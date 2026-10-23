// Chips naming treatments.

import './QualChips.css';

import { GENERAL_COURSES, type GeneralId, isGeneral, MODALITIES, type Modality } from '../../../core/data';
import type { CourseId } from '../../../core/state/types';
import { IconText } from './Icon';

/**
 * Chips naming the treatments someone is qualified in, and the general courses they have passed, with a dashed one
 * for the course they are on, if it teaches a treatment or a general course.
 */
export function QualChips({
  quals,
  general = [],
  learning,
}: {
  quals: readonly Modality[];
  general?: readonly GeneralId[];
  learning?: CourseId | undefined;
}) {
  const course = learning === 'skill' ? undefined : learning;
  if (!quals.length && !general.length && !course) return null;
  const studied = course && (isGeneral(course) ? GENERAL_COURSES[course] : MODALITIES[course]);
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
      {studied && (
        <span class="learning" title={`On the ${studied.name} course`}>
          <IconText id={studied.icon}>{`Learning ${studied.name}`}</IconText>
        </span>
      )}
    </div>
  );
}
