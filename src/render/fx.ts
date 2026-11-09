// Switches for the graphics pass while it is being tried out: each upgrade to the picture is behind one, so the same
// build can be shot with and without it and its cost measured. Read once from the page's address as the game loads:
// `?fx=all`, or a list such as `?fx=grounding,wind`. With none named, the game draws as it did.

/** Every upgrade that can be switched on. */
export const FX_NAMES = [
  /** Soft shade painted where walls and furniture meet the floor, and up the foot of the walls. */
  'grounding',
  /** A soft sky for glossy surfaces and glass to reflect. */
  'sky',
  /** Softer-edged, better-defined shadows from the sun. */
  'softshadow',
  /** A richer ground outdoors: mottled turf, tufts and flowers, and each setting's own detail. */
  'lawn',
  /** Trees and plants swaying in the wind. */
  'wind',
  /** Small living things and drifting bits outdoors and in: butterflies, birds, falling leaves, dust in the light. */
  'life',
  /** A glow around lamps, screens, candles and whatever else is lit from inside. */
  'glow',
  /** Small moments of motion in the world: dust where something is put down, sparkles on a cure, items that idle. */
  'juice',
] as const;
export type Fx = (typeof FX_NAMES)[number];

/** The upgrades named in the page's address. */
function named(): ReadonlySet<string> {
  // the unit tests build models with no page
  if (typeof location === 'undefined') return new Set();
  const list = new URLSearchParams(location.search).get('fx') ?? '';
  return new Set(list.split(',').filter(Boolean));
}

const ON = named();

/** Whether an upgrade is switched on. */
export const fx = (name: Fx): boolean => ON.has('all') || ON.has(name);
