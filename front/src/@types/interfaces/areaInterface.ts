import { UnitOnBoardInterface } from "./unitInterface";

export interface AreaInterface {
  id: number;
  i: number;
  j: number;
  key: string;
  controlPoint: boolean;
  controlledBy: number | null;
  unitOnIt: UnitOnBoardInterface | null;
  canPostOn: boolean;
  areasAround: string[];
  areasAt2Cases: string[];
  canAttack: boolean;
}
