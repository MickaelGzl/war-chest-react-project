import { UnitInterface } from "../interfaces";

export type MovementTypes = "move" | "reinforce" | "control" | "ally-attack" | "ally-move";

export type PendingAction =
  | { type: "cavalerie-moved"; fromAreaId: number; toAreaId: number; unit: UnitInterface }
  | { type: "soldat-attacked"; fromAreaId: number; attackedAreaId: number; unit: UnitInterface }
  | { type: "berserk-active"; currentAreaId: number; moveHistory: number[]; sacrifices: number; unit: UnitInterface }
  | { type: "porte-etendard-select-ally"; bannerAreaId: number; unit: UnitInterface }
  | { type: "porte-etendard-move-ally"; bannerAreaId: number; allyFromAreaId: number; allyUnit: UnitInterface; unit: UnitInterface }
  | { type: "capitaine-select-ally"; captainAreaId: number; unit: UnitInterface }
  | { type: "capitaine-ally-attacks"; captainAreaId: number; allyAreaId: number; allyUnit: UnitInterface; unit: UnitInterface }
  | { type: "moine-extra"; moineAreaId: number; unit: UnitInterface }
  | { type: "fantassin-second"; firstAreaId: number; unit: UnitInterface }
  | { type: "sceau-royal"; gardeRoyaleAreaId: number; unit: UnitInterface };
