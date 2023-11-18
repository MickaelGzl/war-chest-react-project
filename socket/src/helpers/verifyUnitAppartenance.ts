import { PlayerInterface, UnitInterface } from "../@types/interface";

/**
 * function that return a boolean value of if the unit doesn't belong to the player
 * @param unit the unit on the area
 * @returns a boolean value to verify if the unit on the area belong to player
 */
export const unitIsNotOneOfPlayer = (
  unit: UnitInterface,
  players: PlayerInterface[],
  socketTurn: string
): boolean => {
  return !players
    .find((p) => p.socketId === socketTurn)!
    .units.find((u) => u.id === unit.id);
};
