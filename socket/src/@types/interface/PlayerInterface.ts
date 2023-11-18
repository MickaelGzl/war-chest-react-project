import { UnitInterface } from "./UnitInterface";

export interface PlayerInterface {
  id: number;
  socketId: string;
  initToken: string;
  units: UnitInterface[];
  bag: UnitInterface[];
  hand: UnitInterface[];
  unitOnHold: UnitInterface[];
}
