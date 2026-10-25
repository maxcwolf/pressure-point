// Fires, and the fire brigade. Only a treatment machine smoking with wear catches fire, and only when it overloads: a
// share of the overloads of a machine with a flame or a motor are fires. A fire spreads to what stands beside it in its
// room until a Caretaker puts it out (quickly with a Fire Extinguisher near the room's door), sprinklers put it out
// on their own, or the fire brigade, called the moment it starts, hoses it out and sends the bill.

/** How often a fire spreads to something breakable beside what is burning, in seconds. */
export const BLAZE_SPREAD_SECONDS = 12;

/** How long a Caretaker takes to put a fire out with a Fire Extinguisher near the room's door, in seconds. */
export const DOUSE_SECONDS = 3;

/** How long a Caretaker takes to beat a fire out with no Fire Extinguisher near, in seconds. */
export const BEAT_SECONDS = 15;

/** How long sprinklers take to put a fire out in their room, in seconds: before it can spread. */
export const SPRINKLER_SECONDS = 4;

/** How long after a fire starts the fire truck turns into the street, in seconds. */
export const BRIGADE_CALL_SECONDS = 30;

/** How fast the fire truck drives along the street, in tiles a second. */
export const TRUCK_SPEED = 3.5;

/** How long a firefighter hoses each burning thing before it is out, in seconds. */
export const HOSE_SECONDS = 4;

/** How long the crew stand and look before they go, when they find the fire already out, in seconds. */
export const SHRUG_SECONDS = 2;

/** What the fire brigade charges for a call-out on which they had to put a fire out. Nothing, if it was out already. */
export const BRIGADE_FEE = 2500;

/** What sprinklers cost to fit in a room, and the star they can be fitted from. */
export const SPRINKLER_COST = 1500;
export const SPRINKLER_STAR = 3;

/** How many firefighters come on the truck. */
export const CREW_SIZE = 2;

/** How many tiles behind the cab's middle the truck parks from the front door, along the street. */
export const TRUCK_PARK = 4;

/** What the speakers say as a fire starts, as the crew finish, whether they had to put it out or not, and as they go. */
export const BLAZE_NEWS = {
  start: 'There is a small fire. The fire brigade has been called. Please walk calmly away from anything glowing.',
  hosed: 'The fire brigade has put the fire out. Please mind the puddles, and the firefighters.',
  shrug: 'The fire brigade would like it known that the fire was already out. They are leaving, slightly disappointed.',
  gone: 'The fire brigade has gone. Normal relaxation may resume.',
} as const;
