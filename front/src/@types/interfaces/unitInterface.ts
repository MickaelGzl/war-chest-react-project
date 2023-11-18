import { AreaInterface } from "./areaInterface";
import { PlayerInterface } from "./playerInterface";

export interface UnitInterface {
  id: number;
  name: string;
  cap: string;
  nb: number;
}

export interface UnitOnBoardInterface extends UnitInterface {
  reinforce: number;
}

export interface UnitOnReposeInterface extends UnitInterface {
  unvisible?: boolean;
}
