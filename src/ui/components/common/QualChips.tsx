// Chips naming treatments.

import { GENERAL_COURSES, type GeneralId, isGeneral, MODALITIES, type Modality } from '../../../core/data';
import type { CourseId } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { cx } from '../../lib/cx';
import { IconText } from './Icon';

/** The row of chips, each a treatment or a course in a small lilac pill. */
const chips = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4',
  m: '0',
  mt: '2',
  mb: '4',
  '& > span': {
    fontSize: '12',
    fontWeight: 'medium',
    bg: 'special.bg',
    border: '[{borderWidths.fine} solid {colors.special.solid}]',
    borderRadius: '8',
    py: '0',
    px: '6',
    whiteSpace: 'nowrap',
  },
  '& > span.general': { bg: 'highlight.bg', borderColor: 'highlight' },
  // the course they are on, not yet passed
  '& > span.learning': { bg: 'bg.card', borderStyle: 'dashed', opacity: 'soft' },
});

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
    <div class={cx('quals', chips)}>
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
