// Every machine's gag, by the item it plays on.

import type { ItemType } from '../../../core/data';
import type { GagScript } from '../types';
import { AURA_WASH } from './aura-wash';
import { CIDER_PRESS } from './cider-press';
import { GREAT_ALPHORN } from './great-alphorn';
import { KNEADMASTER } from './kneadmaster';
import { PIN_PRESS } from './pin-press';
import { BIG_GONG, FOG_MACHINE, GEODE, OCTOPUS, STONE_KILN } from './upgrades';
import { WHEEL_OF_REBIRTH } from './wheel-of-rebirth';

/** The gag each machine plays. An item missing here has none. */
export const GAGS: Partial<Record<ItemType, GagScript>> = {
  kneadmaster: KNEADMASTER,
  pin_press: PIN_PRESS,
  aura_wash: AURA_WASH,
  great_alphorn: GREAT_ALPHORN,
  cider_press: CIDER_PRESS,
  wheel_of_rebirth: WHEEL_OF_REBIRTH,
  stone_kiln: STONE_KILN,
  octopus: OCTOPUS,
  geode: GEODE,
  big_gong: BIG_GONG,
  fog_machine: FOG_MACHINE,
};
