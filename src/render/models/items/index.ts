// Every item's model, by type.

import * as THREE from 'three';

import type { ItemType } from '../../../core/data';
import { buildAcuTable } from './acu-table';
import { buildBench } from './bench';
import { buildBin } from './bin';
import { buildCabinet } from './cabinet';
import { buildConsultDesk } from './consult-desk';
import { buildCuppingCart } from './cupping-cart';
import { buildDiffuser } from './diffuser';
import { buildFountain } from './fountain';
import { buildMagazineRack } from './magazine-rack';
import { buildMassageTable } from './massage-table';
import { buildMoxaBurner } from './moxa-burner';
import { buildNeedleCabinet } from './needle-cabinet';
import { buildOilTrolley } from './oil-trolley';
import { buildPlant } from './plant';
import { buildPostureScanner } from './posture-scanner';
import { buildReceptionDesk } from './reception-desk';
import { buildRug } from './rug';
import { buildSaltLamp } from './salt-lamp';
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
import { buildWhiteboard } from './whiteboard';

/** What builds each item's model. Every item type has to have one. */
const BUILDERS: Record<ItemType, (g: THREE.Group) => void> = {
  reception_desk: buildReceptionDesk,
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
  stone_warmer: buildStoneWarmer,
  stretch_rack: buildStretchRack,
  whiteboard: buildWhiteboard,
  study_desk: buildStudyDesk,
};

/** Build an item in its local frame: origin at the footprint center, +z is the front. */
export function buildItem(type: ItemType): THREE.Group {
  const g = new THREE.Group();
  BUILDERS[type](g);
  return g;
}
