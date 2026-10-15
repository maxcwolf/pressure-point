// Names and flavor text.

import type { Sex } from './types';

export const GAME_TITLE = 'Pressure Point Institute';

/** The title broken up for the places that stack it: the lawn sign and the title screen. */
export const TITLE_LINES = ['Pressure', 'Point', 'Institute'] as const;

/** Flavor for emergencies: a batch of guests who all turn up with the same condition. */
export const EMERGENCY_CAUSES = [
  'A yoga retreat attempted a group pose and it went badly.',
  'The city fun run turned out to be an unfun run.',
  'An all-hands meeting ran three hours over with no chairs.',
  'A flash mob forgot to warm up.',
  'The local choir held one note for far too long.',
  'A furniture store ran a build-it-yourself weekend.',
];

/** First names for women. */
export const WOMEN_NAMES = [
  'Ada',
  'Cleo',
  'Edie',
  'Greta',
  'Ines',
  'Kiki',
  'Mabel',
  'Odette',
  'Queenie',
  'Saskia',
  'Uma',
  'Wilma',
  'Yolanda',
  'Priya',
  'Amara',
  'Noor',
  'Tamsin',
  'Beatrix',
  'Marisol',
  'Hazel',
  'Ingrid',
  'Rosalind',
];

/** First names for men. */
export const MEN_NAMES = [
  'Barnaby',
  'Dmitri',
  'Fergus',
  'Hamish',
  'Jasper',
  'Lionel',
  'Nico',
  'Percy',
  'Rufus',
  'Tobias',
  'Vernon',
  'Xander',
  'Zeb',
  'Kenji',
  'Mateo',
  'Soren',
  'Idris',
  'Cosmo',
  'Otis',
  'Ravi',
  'Bram',
  'Felix',
];

export const LAST_NAMES = [
  'Kneadham',
  'Rubsworth',
  'Stretchley',
  'Oilfield',
  'Thumbwell',
  'Knuckleby',
  'Palmer-Pressley',
  'Soothington',
  'Limberlake',
  'Achewood',
  'Tenderson',
  'Crickmore',
  'Spinewell',
  'Loosely',
  'Relaxworth',
  'Supple',
  'Kinkaid',
  'Twinge',
  'Balmforth',
  'Unwind',
  'Shoulders',
  'Calmley',
  'Flexmoor',
  'Easeby',
  'Musselwhite',
  'Pummell',
  'Glide',
  'Hotstone',
];

/** Full names borrowed from Tim and Eric, mixed in among the generated ones, each a woman or a man. */
export const CAMEOS: readonly { name: string; sex: Sex }[] = [
  { name: 'Max Wolf', sex: 'male' },
  { name: 'Tanner Costin', sex: 'male' },
  { name: 'Katie Maverick', sex: 'female' },
  { name: 'Rang Dipkin', sex: 'male' },
  { name: 'Bilb Ono', sex: 'male' },
  { name: 'Hosta Mohogey', sex: 'female' },
  { name: 'Tairy Greene', sex: 'male' },
  { name: 'Steve Brule', sex: 'male' },
  { name: 'Jan Skylar', sex: 'female' },
  { name: 'Wayne Skylar', sex: 'male' },
  { name: 'Carol Krabit', sex: 'female' },
  { name: 'Casey Tatum', sex: 'male' },
  { name: 'Glen Tennis', sex: 'male' },
  { name: 'Doug Prishpreed', sex: 'male' },
  { name: 'Scott Clam', sex: 'male' },
  { name: 'Jimes Tooper', sex: 'male' },
  { name: 'Terry Bruge-Hiplo', sex: 'male' },
];

export const ANNOUNCEMENTS = [
  'Guests are reminded that the knots are not contagious.',
  'Would the owner of a red aura please move it from the fire exit.',
  'Please do not tip the therapists. They fall over.',
  'Staff members are reminded that whale song is not a valid doctor’s note.',
  'Guests are asked not to hum along with the fountain.',
  'The herbal tea is herbal. That is all we are prepared to say.',
  'Please keep your chakras aligned and your belongings with you.',
  'Guests leaving face-shaped marks on the towels will be charged.',
  'A reminder that relaxation is mandatory.',
  'The lost and found now holds one flip-flop and a sense of urgency.',
  'Please breathe in. Further instructions will follow.',
  'Guests are reminded that clothing is mandatory in the hallways.',
  'Attention male visitors, please do not completely remove your pants while using the urinal.',
  'Welcome, seekers. We remind you that enlightenment is a journey, and our gift shop accepts all major credit cards.',
  'A polite reminder: Mercury is no longer in retrograde, so you have absolutely no excuse for your behavior.',
  'Reminder: Screaming into the void is permitted only between the hours of two and four PM.',
  'Visitors are reminded that sighing heavily does not count as breathwork.',
];
