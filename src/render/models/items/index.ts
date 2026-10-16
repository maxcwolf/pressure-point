// Every item's model, by type.

import * as THREE from 'three';

import { type CenterId, type ItemType, rugPattern, type RugPatternId } from '../../../core/data';
import { mergeStill } from '../merge';
import { trimShadows } from '../parts';
import { buildAcuTable } from './acu-table';
import { buildAirConditioner } from './air-conditioner';
import { buildAquarium } from './aquarium';
import { buildArcadeMachine } from './arcade-machine';
import { buildBench } from './bench';
import { buildBin } from './bin';
import { buildBonsai } from './bonsai';
import { buildBookcase } from './bookcase';
import { buildBrewPot } from './brew-pot';
import { buildCabinet } from './cabinet';
import { buildCeremonyMat } from './ceremony-mat';
import { buildCoffeeMachine } from './coffee-machine';
import { buildConsultDesk } from './consult-desk';
import { buildCrystalBowls } from './crystal-bowls';
import { buildCrystalGrid } from './crystal-grid';
import { buildCuppingCart } from './cupping-cart';
import { buildDiffuser } from './diffuser';
import { buildEmberBowl } from './ember-bowl';
import { buildFireExtinguisher } from './fire-extinguisher';
import { buildFireplace } from './fireplace';
import { buildFortuneTeller } from './fortune-teller';
import { buildFountain } from './fountain';
import { buildGong } from './gong';
import { buildInstructorMat } from './instructor-mat';
import { buildKoiPond } from './koi-pond';
import { buildKombuchaTap } from './kombucha-tap';
import { buildLandscapePainting } from './landscape-painting';
import { buildLinenHamper } from './linen-hamper';
import { buildMagazineRack } from './magazine-rack';
import { buildMassageChair } from './massage-chair';
import { buildMassageTable } from './massage-table';
import { buildMotivationalPoster } from './motivational-poster';
import { buildMoxaBurner } from './moxa-burner';
import { buildMushroomAltar } from './mushroom-altar';
import { buildNeedleCabinet } from './needle-cabinet';
import { buildOilTrolley } from './oil-trolley';
import { buildPlant } from './plant';
import { buildPoolTable } from './pool-table';
import { buildPostureScanner } from './posture-scanner';
import { buildPracticeSpot } from './practice-spot';
import { buildRadiator } from './radiator';
import { buildRattle } from './rattle';
import { buildReceptionDesk } from './reception-desk';
import { buildRecliner } from './recliner';
import { buildReikiAltar } from './reiki-altar';
import { buildReikiTable } from './reiki-table';
import { buildRug } from './rug';
import { buildSaltLamp } from './salt-lamp';
import { buildShopCounter } from './shop-counter';
import { buildSingingBowls } from './singing-bowls';
import { buildSink } from './sink';
import { buildSnackMachine } from './snack-machine';
import { buildSofa } from './sofa';
import { buildSoundMat } from './sound-mat';
import { buildSoundproofPanel } from './soundproof-panel';
import { buildStaffFridge } from './staff-fridge';
import { buildStatue } from './statue';
import { buildStimUnit } from './stim-unit';
import { buildStoneWarmer } from './stone-warmer';
import { buildStretchRack } from './stretch-rack';
import { buildStudyDesk } from './study-desk';
import { buildSweatLodge } from './sweat-lodge';
import { buildTeaStation } from './tea-station';
import { buildToilet } from './toilet';
import { buildTopiary } from './topiary';
import { buildTrophyCabinet } from './trophy-cabinet';
import { buildWallClock } from './wall-clock';
import { buildWaterCooler } from './water-cooler';
import { buildWhiteboard } from './whiteboard';
import { buildWindChimes } from './wind-chimes';

/**
 * What builds each item's model. Every item type has to have one. A rug is built in its pattern, and a painting of the
 * view at its center.
 */
const BUILDERS: Record<ItemType, (g: THREE.Group, look?: string) => void> = {
  reception_desk: buildReceptionDesk,
  shop_counter: buildShopCounter,
  consult_desk: buildConsultDesk,
  cabinet: buildCabinet,
  massage_table: buildMassageTable,
  oil_trolley: buildOilTrolley,
  sofa: buildSofa,
  bench: buildBench,
  toilet: buildToilet,
  sink: buildSink,
  plant: buildPlant,
  tea_station: buildTeaStation,
  snack_machine: buildSnackMachine,
  bin: buildBin,
  fountain: buildFountain,
  posture_scanner: buildPostureScanner,
  salt_lamp: buildSaltLamp,
  diffuser: buildDiffuser,
  statue: buildStatue,
  /** A rug in its pattern. */
  rug: (g, look) => buildRug(g, look as RugPatternId),
  magazine_rack: buildMagazineRack,
  acu_table: buildAcuTable,
  needle_cabinet: buildNeedleCabinet,
  cupping_cart: buildCuppingCart,
  moxa_burner: buildMoxaBurner,
  stim_unit: buildStimUnit,
  reiki_table: buildReikiTable,
  reiki_altar: buildReikiAltar,
  crystal_grid: buildCrystalGrid,
  singing_bowls: buildSingingBowls,
  sound_mat: buildSoundMat,
  recliner: buildRecliner,
  instructor_mat: buildInstructorMat,
  practice_spot: buildPracticeSpot,
  ceremony_mat: buildCeremonyMat,
  ember_bowl: buildEmberBowl,
  rattle: buildRattle,
  sweat_lodge: buildSweatLodge,
  mushroom_altar: buildMushroomAltar,
  brew_pot: buildBrewPot,
  gong: buildGong,
  crystal_bowls: buildCrystalBowls,
  stone_warmer: buildStoneWarmer,
  stretch_rack: buildStretchRack,
  whiteboard: buildWhiteboard,
  study_desk: buildStudyDesk,
  water_cooler: buildWaterCooler,
  fire_extinguisher: buildFireExtinguisher,
  arcade_machine: buildArcadeMachine,
  bookcase: buildBookcase,
  coffee_machine: buildCoffeeMachine,
  aquarium: buildAquarium,
  pool_table: buildPoolTable,
  trophy_cabinet: buildTrophyCabinet,
  bonsai: buildBonsai,
  massage_chair: buildMassageChair,
  koi_pond: buildKoiPond,
  radiator: buildRadiator,
  fireplace: buildFireplace,
  topiary: buildTopiary,
  air_conditioner: buildAirConditioner,
  linen_hamper: buildLinenHamper,
  soundproof_panel: buildSoundproofPanel,
  wind_chimes: buildWindChimes,
  fortune_teller: buildFortuneTeller,
  kombucha_tap: buildKombuchaTap,
  staff_fridge: buildStaffFridge,
  motivational_poster: buildMotivationalPoster,
  /** A painting of the view at its center. */
  landscape_painting: (g, look) => buildLandscapePainting(g, look as CenterId),
  wall_clock: buildWallClock,
};

/** How an item looks, where it comes in more than one look: a rug's pattern, and the center a painting is of. */
export interface ItemLook {
  pattern?: RugPatternId | undefined;
  center?: CenterId | undefined;
}

/**
 * Build an item in its local frame: origin at the footprint center, +z is the front; for something hung on a wall,
 * the wall's face is at z = 0. A rug comes in its pattern, and a painting shows the view at its center.
 */
export function buildItem(type: ItemType, { pattern, center }: ItemLook = {}): THREE.Group {
  const g = new THREE.Group();
  const look = type === 'rug' ? rugPattern(pattern) : type === 'landscape_painting' ? (center ?? 'sandbox') : undefined;
  BUILDERS[type](g, look);
  trimShadows(g);
  mergeStill(g, look && look !== 'kilim' ? `item:${type}:${look}` : `item:${type}`);
  return g;
}
