// Visitors who judge the center: VIPs, who write ahead and tour a few rooms with their own tastes, and the health
// inspector, who calls on every center now and then and checks every room against the rules.

/** What a visitor can look at in a room. */
export type Aspect = 'decor' | 'cleanliness' | 'calm' | 'warmth' | 'equipment';

/** A kind of VIP: who they are, and what they care about most. */
export interface VipDef {
  title: string;
  cares: Aspect;
}

export const VIPS: readonly VipDef[] = [
  { title: 'a lifestyle columnist', cares: 'decor' },
  { title: 'a retired surgeon', cares: 'cleanliness' },
  { title: 'a meditation teacher', cares: 'calm' },
  { title: 'a travel writer just back from the tropics', cares: 'warmth' },
  { title: 'a gadget reviewer', cares: 'equipment' },
];

/** How each aspect reads in a visitor's notes, when it pleased them and when it did not. */
export const ASPECT_NOTES: Readonly<Record<Aspect, { good: string; bad: string; name: string }>> = {
  decor: { good: 'beautifully done', bad: 'bare and drab', name: 'decor' },
  cleanliness: { good: 'spotless', bad: 'grubby', name: 'cleanliness' },
  calm: { good: 'lovely and quiet', bad: 'far too noisy', name: 'peace and quiet' },
  warmth: { good: 'just the right temperature', bad: 'uncomfortably cold or hot', name: 'the temperature' },
  equipment: { good: 'in fine working order', bad: 'let down by broken equipment', name: 'working equipment' },
};

/** How many days ahead a visitor writes, and how long they spend looking round each room, in seconds. */
export const VISIT_NOTICE_DAYS = 5;
export const LOOK_SECONDS = 4;

/** Days from the start until the first VIP may write (once the center has a star), and between one and the next. */
export const VIP_FIRST_DAY = 30;
export const VIP_GAP_DAYS: readonly [number, number] = [45, 90];
/** How many rooms a VIP tours, at least and at most. */
export const VIP_ROOMS: readonly [number, number] = [3, 5];
/** How many times more a VIP weighs what they care about than anything else. */
export const VIP_CARES = 3;
/** A VIP's verdict from 0 to 100: from here they are delighted, and below this they are disappointed. */
export const VIP_DELIGHTED = 70;
export const VIP_DISAPPOINTED = 40;
/** What a delighted VIP leaves for each star the center has (the first counting even before it is earned). */
export const VIP_PRIZE = 1500;
/** Reputation gained from a delighted VIP, or lost to a disappointed one. */
export const VIP_REP = 4;

/** Days from the start until the first inspection, and between one and the next. */
export const INSPECTION_FIRST_DAY = 60;
export const INSPECTION_GAP_DAYS: readonly [number, number] = [120, 180];
/** The most rooms the inspector looks round. */
export const INSPECTOR_ROOMS = 6;
/** Problems the inspector lets go before the center fails. */
export const INSPECTION_ALLOWED = 1;
/** The fine for each problem found in a failed inspection, and the reputation it costs. */
export const INSPECTION_FINE = 800;
export const INSPECTION_REP = 3;
/** Reputation gained from passing an inspection with nothing found. */
export const INSPECTION_CLEAN_REP = 2;
/** How near a room's door, in tiles, a Fire Extinguisher has to be for the inspector to count it. */
export const EXTINGUISHER_REACH = 8;
