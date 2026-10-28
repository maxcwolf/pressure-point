// Features still being tried out: each can be switched on or off in Settings, under Feature testing, while it is.

import type { IconId } from './icon-ids';

export type FeatureId = 'waves';

export interface FeatureDef {
  id: FeatureId;
  name: string;
  desc: string;
  icon: IconId;
  /** Whether a new game has it unless the player says otherwise. */
  on: boolean;
}

export const FEATURES: Readonly<Record<FeatureId, FeatureDef>> = {
  waves: {
    id: 'waves',
    name: 'Ailments going around',
    desc: 'Now and then an ailment goes around town, with a week’s warning, and opens its treatment early. For now only The Exchange, after its first star.',
    icon: 'bubble-sick',
    on: false,
  },
};

/** The features being tried out, in the order Settings lists them. */
export const FEATURE_ORDER = Object.keys(FEATURES) as FeatureId[];
