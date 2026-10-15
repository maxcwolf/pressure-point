// Every item's model, by type.

import * as THREE from 'three';

import type { ItemType } from '../../../core/data';
import { trimShadows } from '../parts';
import { buildAcuTable } from './acu-table';
import { buildAirConditioner } from './air-conditioner';
import { buildAquarium } from './aquarium';
import { buildArcadeMachine } from './arcade-machine';
import { buildBench } from './bench';
import { buildBin } from './bin';
import { buildBonsai } from './bonsai';
import { buildBookcase } from './bookcase';
import { buildCabinet } from './cabinet';
import { buildCoffeeMachine } from './coffee-machine';
import { buildConsultDesk } from './consult-desk';
import { buildCrystalGrid } from './crystal-grid';
import { buildCuppingCart } from './cupping-cart';
import { buildDiffuser } from './diffuser';
import { buildFireExtinguisher } from './fire-extinguisher';
import { buildFireplace } from './fireplace';
import { buildFountain } from './fountain';
import { buildKoiPond } from './koi-pond';
import { buildLinenHamper } from './linen-hamper';
import { buildMagazineRack } from './magazine-rack';
import { buildMassageChair } from './massage-chair';
import { buildMassageTable } from './massage-table';
import { buildMoxaBurner } from './moxa-burner';
import { buildNeedleCabinet } from './needle-cabinet';
import { buildOilTrolley } from './oil-trolley';
import { buildPlant } from './plant';
import { buildPoolTable } from './pool-table';
import { buildPostureScanner } from './posture-scanner';
import { buildRadiator } from './radiator';
import { buildReceptionDesk } from './reception-desk';
import { buildReikiAltar } from './reiki-altar';
import { buildReikiTable } from './reiki-table';
import { buildRug } from './rug';
import { buildSaltLamp } from './salt-lamp';
import { buildShopCounter } from './shop-counter';
import { buildSingingBowls } from './singing-bowls';
import { buildSink } from './sink';
import { buildSnackMachine } from './snack-machine';
import { buildSofa } from './sofa';
import { buildStatue } from './statue';
import { buildStimUnit } from './stim-unit';
import { buildStoneWarmer } from './stone-warmer';
import { buildStretchRack } from './stretch-rack';
import { buildStudyDesk } from './study-desk';
import { buildTeaStation } from './tea-station';
import { buildToilet } from './toilet';
import { buildTrophyCabinet } from './trophy-cabinet';
import { buildWaterCooler } from './water-cooler';
import { buildWhiteboard } from './whiteboard';

/** What builds each item's model. Every item type has to have one. */
const BUILDERS: Record<ItemType, (g: THREE.Group) => void> = {
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
  rug: buildRug,
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
  air_conditioner: buildAirConditioner,
  linen_hamper: buildLinenHamper,
};

/** Build an item in its local frame: origin at the footprint center, +z is the front. */
export function buildItem(type: ItemType): THREE.Group {
  const g = new THREE.Group();
  BUILDERS[type](g);
  trimShadows(g);
  return g;
}
