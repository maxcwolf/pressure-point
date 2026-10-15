// What guests feel about their visit, the part of the center's reputation each feeling speaks to, and the lines
// they write about it in their reviews.

import type { FeelingDef, FeelingId } from './types';

export const FEELINGS: Readonly<Record<FeelingId, FeelingDef>> = {
  healed: {
    id: 'healed',
    icon: '💖',
    text: 'Healed',
    good: true,
    part: 'results',
    lines: ['Walked in knotted, walked out new.', 'Fixed me right up.', 'Feel better than I have in years.'],
  },
  'not-healed': {
    id: 'not-healed',
    icon: '💢',
    text: 'The treatment did not work',
    good: false,
    part: 'results',
    lines: ['Still knotted. Still paid for the consultation.', 'Did nothing for me.'],
  },
  'sent-home': {
    id: 'sent-home',
    icon: '🏠',
    text: 'Sent home untreated',
    good: false,
    part: 'results',
    lines: ['Sent home without being treated.', 'Waited, then they sent me home.'],
  },
  'no-kit': {
    id: 'no-kit',
    icon: '🧰',
    text: 'The right equipment was not there',
    good: false,
    part: 'results',
    lines: ['They did not have the right equipment.', 'The stones were stone cold.'],
  },
  unqualified: {
    id: 'unqualified',
    icon: '🤔',
    text: 'Treated by someone not trained in it',
    good: false,
    part: 'staff',
    lines: ['Not sure my practitioner had done this before.', 'They were learning on the job. On me.'],
  },
  grump: {
    id: 'grump',
    icon: '😒',
    text: 'Seen by a grump',
    good: false,
    part: 'staff',
    lines: ['The staff could not have cared less.', 'Never met anyone so grumpy.'],
  },
  kind: {
    id: 'kind',
    icon: '🤗',
    text: 'Seen by someone kind',
    good: true,
    part: 'staff',
    lines: ['So kind and attentive.', 'The staff made me feel looked after.'],
  },
  'long-wait': {
    id: 'long-wait',
    icon: '⏳',
    text: 'Waited far too long',
    good: false,
    part: 'experience',
    lines: ['I aged a year in that waiting area.', 'The wait was longer than the treatment.'],
  },
  quick: {
    id: 'quick',
    icon: '⚡',
    text: 'Seen quickly',
    good: true,
    part: 'experience',
    lines: ['In and out in no time.', 'Hardly had to wait at all.'],
  },
  thirsty: {
    id: 'thirsty',
    icon: '🥵',
    text: 'Nothing to drink',
    good: false,
    part: 'experience',
    lines: ['Not a drop to drink while I waited.'],
  },
  hungry: {
    id: 'hungry',
    icon: '😫',
    text: 'Nothing to eat',
    good: false,
    part: 'experience',
    lines: ['Starving by the time they called me.'],
  },
  bursting: {
    id: 'bursting',
    icon: '😖',
    text: 'Could not find a restroom',
    good: false,
    part: 'experience',
    lines: ['Could not find a restroom anywhere.'],
  },
  'filthy-toilet': {
    id: 'filthy-toilet',
    icon: '🤢',
    text: 'Used a filthy toilet',
    good: false,
    part: 'experience',
    lines: ['The restroom needs a treatment of its own.'],
  },
  litter: {
    id: 'litter',
    icon: '🗑️',
    text: 'Litter everywhere',
    good: false,
    part: 'experience',
    lines: ['Wrappers all over the floor.'],
  },
  pleasant: {
    id: 'pleasant',
    icon: '🌿',
    text: 'A lovely place to wait',
    good: true,
    part: 'experience',
    lines: ['Such a lovely place to wait.', 'Beautiful, calm waiting area.'],
  },
  comfy: { id: 'comfy', icon: '🛋️', text: 'A comfy seat', good: true, part: 'experience', lines: ['Comfy seats.'] },
  refreshed: {
    id: 'refreshed',
    icon: '🍵',
    text: 'Had a drink or a snack',
    good: true,
    part: 'experience',
    lines: ['The herbal tea was a nice touch.'],
  },
  played: {
    id: 'played',
    icon: '🕹️',
    text: 'Played a game while waiting',
    good: true,
    part: 'experience',
    lines: ['Beat my high score while I waited.'],
  },
  'fine-room': {
    id: 'fine-room',
    icon: '✨',
    text: 'Treated in a beautiful room',
    good: true,
    part: 'experience',
    lines: ['The treatment room was gorgeous.'],
  },
  pricey: {
    id: 'pricey',
    icon: '💸',
    text: 'The prices were steep',
    good: false,
    part: 'value',
    lines: ['Good, but the prices!', 'Far too expensive.'],
  },
  bargain: {
    id: 'bargain',
    icon: '🏷️',
    text: 'Good value for money',
    good: true,
    part: 'value',
    lines: ['Great value for money.', 'Cheaper than I expected.'],
  },
  worse: {
    id: 'worse',
    icon: '🤕',
    text: 'Got worse while waiting',
    good: false,
    part: 'results',
    lines: ['Came in bad, left worse.', 'I got worse in the waiting area. In the waiting area!'],
  },
  'bad-vibes': {
    id: 'bad-vibes',
    icon: '☁️',
    text: 'Treated in a room with bad vibes',
    good: false,
    part: 'experience',
    lines: ['Something felt off about that room.', 'The treatment room had a cloud over it. An actual cloud.'],
  },
  calmed: {
    id: 'calmed',
    icon: '😌',
    text: 'Calmed down when it all got too much',
    good: true,
    part: 'staff',
    lines: ['They talked me down when I was in a state.', 'Kept their cool when I could not keep mine.'],
  },
  noisy: {
    id: 'noisy',
    icon: '🔊',
    text: 'A noisy treatment room',
    good: false,
    part: 'experience',
    lines: ['Hard to relax with an arcade machine going next door.', 'I could hear every word from the waiting area.'],
  },
  peaceful: {
    id: 'peaceful',
    icon: '🤫',
    text: 'A peaceful treatment room',
    good: true,
    part: 'experience',
    lines: ['So quiet I nearly fell asleep on the table.', 'Peace and quiet at last.'],
  },
  'stale-linens': {
    id: 'stale-linens',
    icon: '🧺',
    text: 'Stale linens on the table',
    good: false,
    part: 'experience',
    lines: ['The sheets on the table had seen a few guests before me.', 'Change the towels, please.'],
  },
  'too-cold': {
    id: 'too-cold',
    icon: '🥶',
    text: 'Too cold',
    good: false,
    part: 'experience',
    lines: ['Freezing. Kept my coat on the whole time.', 'Could see my breath in the waiting area.'],
  },
  'too-hot': {
    id: 'too-hot',
    icon: '🥵',
    text: 'Too hot',
    good: false,
    part: 'experience',
    lines: ['Like waiting in a sauna, only without the benefits.', 'Sweltering. Open a window.'],
  },
};

/** The parts of a center's reputation, in the order they are shown. */
export const REPUTATION_PARTS = ['results', 'experience', 'value', 'staff'] as const;

/** What each part of the reputation is called, and what it is about. */
export const PART_NAMES: Readonly<Record<(typeof REPUTATION_PARTS)[number], { name: string; desc: string }>> = {
  results: { name: 'Results', desc: 'Treatments that work' },
  experience: { name: 'Experience', desc: 'Waits, comforts and surroundings' },
  value: { name: 'Value', desc: 'What it costs' },
  staff: { name: 'Staff', desc: 'Who looks after them' },
};

/** How many reviews are kept, and the price levels guests find steep, and a bargain. */
export const REVIEWS_KEPT = 40;
export const PRICEY = 1.3;
export const BARGAIN = 0.8;
/** A wait counts as quick under this many days. */
export const QUICK_DAYS = 1.5;
/** A guest whose patience falls this low feels they waited too long. */
export const LONG_WAIT_PATIENCE = 35;
/** Surroundings this pleasant (a patience drain this low) make a guest feel it is a lovely place to wait. */
export const PLEASANT_DRAIN = 0.85;
