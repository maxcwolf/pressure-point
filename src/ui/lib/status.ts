// Describing what people are up to, in a few words.

import { DISCIPLINES, ITEMS, modalityLabel, ROOMS } from '../../core/data';
import type { Sim } from '../../core/sim/sim';
import type { CourseId, Guest, Staff } from '../../core/state/types';

/** What a guest is doing, in a few words. */
export function guestStatus(g: Guest, sim: Sim): string {
  const st = sim.world.item(g.station);
  const where = st ? ITEMS[st.type].name : '';
  switch (g.state) {
    case 'enter':
      return 'Arriving';
    case 'toWait':
    case 'waiting':
      if (!st)
        return g.goal === 'treat'
          ? `Waiting for a working ${ROOMS[DISCIPLINES[sim.modalityOf(g).discipline].room].name}`
          : g.goal === 'consult'
            ? 'Waiting for a Consultation Room to exist'
            : g.goal === 'assess'
              ? 'Waiting for a working Posture Lab'
              : 'Looking for Reception';
      return g.goal === 'reception'
        ? 'In line at Reception'
        : g.goal === 'consult'
          ? 'Waiting for a consultation'
          : g.goal === 'assess'
            ? 'Waiting for a posture scan'
            : 'Waiting for treatment';
    case 'called':
      return `Heading to the ${where}`;
    case 'served':
      return g.goal === 'reception'
        ? 'Checking in'
        : g.goal === 'consult'
          ? 'Being diagnosed'
          : g.goal === 'assess'
            ? 'Being scanned'
            : 'Being treated';
    case 'toNeed':
    case 'need':
      return g.needKind === 'toilet'
        ? 'Answering a call of nature'
        : g.needKind === 'drink'
          ? 'Getting a herbal tea'
          : 'Getting a snack';
    case 'leaving':
      return g.outcome === 'healed'
        ? 'Going home healed'
        : g.outcome === 'failed'
          ? 'Going home, still knotted'
          : g.outcome === 'stormed'
            ? 'Leaving in a huff'
            : 'Leaving';
  }
}

/** What a member of staff is doing, in a few words. */
export function staffStatus(st: Staff, sim: Sim): string {
  const post = sim.world.item(st.post);
  switch (st.state) {
    case 'arriving':
      return 'Arriving for their first day';
    case 'idle':
    case 'wander':
      return st.role === 'caretaker' ? 'Looking for something to clean' : 'Idle: no open station to staff';
    case 'toPost':
      return `Heading to the ${post ? ITEMS[post.type].name : 'station'}`;
    case 'atPost':
      return st.busy ? 'Working' : 'Waiting for a guest';
    case 'toBreak':
      return 'Off for a break';
    case 'onBreak':
      return 'Resting in the Staff Room';
    case 'toJob':
    case 'doingJob':
      if (st.job?.kind === 'repair') return `Repairing the ${ITEMS[sim.world.item(st.job.id)?.type ?? 'bin'].name}`;
      if (st.job?.kind !== 'water') return 'Clearing litter';
      return sim.world.item(st.job.id)?.type === 'stone_warmer' ? 'Reheating the massage stones' : 'Watering a plant';
    case 'toTrain':
      return 'Heading to the Training Room';
    case 'training':
      return `Studying: ${st.training ? courseName(st.training.course) : ''}`;
    case 'leaving':
      return 'Leaving for good';
  }
}

/** The display name of a training course. */
export function courseName(id: CourseId) {
  return id === 'skill' ? 'professional development' : modalityLabel(id);
}
