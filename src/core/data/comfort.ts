// How comfortable the building is: how calm or noisy, how fresh the linens on the tables, how warm or cold, and how
// well fed and watered the staff.

/** How far noise carries, in tiles. */
export const NOISE_RADIUS = 5;
/** Noise a guest makes just by being there, waiting or walking about, and a stressed one. */
export const CROWD_NOISE = 0.5;
export const STRESSED_NOISE = 1.2;
/** How much of the noise outside a room gets through its walls, and how much more each window lets in. */
export const WALL_DAMPING = 0.3;
export const WINDOW_LEAK = 0.08;
/** The most noise a room's walls let through, however many windows it has. */
export const MAX_LEAK = 0.6;
/** Noise from here up is loud: the most it can take off a treatment's chance of working, and how much that is. */
export const NOISE_LOUD = 10;
export const NOISE_PENALTY = 0.12;
/** A guest on the table notices noise from here up, and calls it peaceful below this. */
export const NOISE_NOTICE = 3;
export const NOISE_PEACEFUL = 0.6;

/** Linens are fresh until a Janitor would change them, and stale from the item's filthy mark. */
export const LINENS_STALE = 70;
/** The most stale linens take off the chance of a treatment working. */
export const LINENS_PENALTY = 0.1;
/** Soiled sets of linens a hamper holds, and how full it gets before a Janitor takes it to be laundered. */
export const HAMPER_SIZE = 8;
export const HAMPER_LAUNDER = 4;
/** How long laundering a hamper's linens takes. */
export const LAUNDER_SECONDS = 5;

/** The indoor temperature guests and staff find just right, in degrees Fahrenheit, and how far either side is fine. */
export const IDEAL_TEMP = 71;
export const COMFORT_BAND = 5;
/** Degrees past the comfortable band at which someone is as uncomfortable as they get. */
export const DISCOMFORT_SPAN = 12;
/** How much of the difference between the weather outside and the ideal gets indoors. */
export const INDOOR_PULL = 0.5;
/** How far a radiator or air conditioner's warmth or cool reaches, in tiles. */
export const HEAT_RADIUS = 4;
/** How much of the warmth or cool outside a room gets through its walls. */
export const HEAT_DAMPING = 0.5;
/** Warmth given off by worn equipment, laboring away. */
export const WORN_HEAT = 3;
/** How much faster an uncomfortable guest loses patience, at worst. */
export const DISCOMFORT_DRAIN = 0.4;
/** How much faster a guest or member of staff gets thirsty in the worst heat. */
export const HEAT_THIRST = 1;
/** How much discomfort lowers the morale staff settle toward, at worst. */
export const DISCOMFORT_MORALE = 10;
/** Someone notices the cold or heat from this much discomfort. */
export const DISCOMFORT_NOTICE = 0.3;

/** How fast staff get thirsty and hungry, in points a second. */
export const STAFF_THIRST = 0.2;
export const STAFF_HUNGER = 0.14;
/** Staff go for a drink or a snack from here, when they are free. */
export const STAFF_NEED_AT = 60;
/** A member of staff this thirsty or hungry is fed up: their morale settles this much lower. */
export const STAFF_NEED_MORALE = 8;
/** How far staff will walk for a drink or a snack, in tiles. */
export const STAFF_NEED_RANGE = 25;
/** How long a drink or a snack takes. */
export const REFRESH_SECONDS = 2;
