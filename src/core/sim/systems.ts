// Everything the systems share.

import type { GameState } from '../state/types';
import { World } from '../world';
import { Advisor } from './advisor';
import { Ambience } from './ambience';
import { Building } from './building';
import { Chars } from './chars';
import { Claims } from './claims';
import { Economy } from './economy';
import { Emergencies } from './emergencies';
import { Events } from './events';
import { Guests } from './guests';
import { Movement } from './movement';
import { Progress } from './progress';
import { Staffing } from './staffing';
import { Stations } from './stations';
import { Training } from './training';
import { Treatments } from './treatments';
import { Upkeep } from './upkeep';

/** The game's state, its world and every system, so that each system can reach the others. */
export class Systems {
  readonly world: World;
  readonly events = new Events(this);
  readonly economy = new Economy(this);
  readonly ambience = new Ambience(this);
  readonly progress = new Progress(this);
  readonly advisor = new Advisor(this);
  readonly treatments = new Treatments(this);
  readonly chars = new Chars(this);
  readonly movement = new Movement(this);
  readonly claims = new Claims(this);
  readonly stations = new Stations(this);
  readonly upkeep = new Upkeep(this);
  readonly guests = new Guests(this);
  readonly staffing = new Staffing(this);
  readonly emergencies = new Emergencies(this);
  readonly training = new Training(this);
  readonly building = new Building(this);

  constructor(readonly s: GameState) {
    this.world = new World(s);
  }
}
