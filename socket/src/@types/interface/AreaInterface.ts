import { UnitInterface } from "./UnitInterface";

export interface AreaInterface {
  id: number;
  i: number;
  j: number;
  key: string;
  controlPoint: boolean;
  controlledBy: number | null;
  unitOnIt: UnitInterface | null;
  canPostOn: boolean;
  areasAround: string[];
  areasAt2Cases: string[];
  canAttack: boolean;
}
