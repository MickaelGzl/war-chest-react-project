import { UnitInterface, UnitOnReposeInterface } from "./unitInterface";

export interface PlayerInterface {
  id: number;
  socketId: string;
  initToken: string;
  units: UnitInterface[];
  bag: UnitInterface[];
  hand: UnitInterface[];
  unitOnHold: UnitOnReposeInterface[];
  graveyard: UnitInterface[];
}
