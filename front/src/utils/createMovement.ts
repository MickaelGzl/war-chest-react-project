import { AreaInterface, PlayerInterface } from "../@types/interfaces";
import { unitIsNotOneOfPlayer } from "./verifyUnitAppartenance";

export function createMovement(
  unitName: string,
  areaOnIt: AreaInterface,
  allAreas: AreaInterface[],
  players: PlayerInterface[],
  socketTurn: string
): AreaInterface[] {
  let newAreas: AreaInterface[] = [];

  switch (unitName) {
    case "Archer":
      newAreas = allAreas.map((a) => {
        if (areaOnIt.areasAround.includes(a.key) && !a.unitOnIt) {
          a.canPostOn = true;
        } else if (
          //verify if is a unit is in the middle
          areaOnIt.areasAt2Cases.includes(a.key) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;

    case "Arbalétrier":
      newAreas = allAreas.map((a) => {
        if (areaOnIt.areasAround.includes(a.key) && !a.unitOnIt) {
          a.canPostOn = true;
        } else if (
          //verify if is an unit on the middle, like Archer
          (areaOnIt.areasAt2Cases.includes(a.key) ||
            areaOnIt.areasAround.includes(a.key)) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;

    case "Cavalerie légère":
      newAreas = allAreas.map((a) => {
        if (
          (areaOnIt.areasAround.includes(a.key) ||
            areaOnIt.areasAt2Cases.includes(a.key)) &&
          !a.unitOnIt
        ) {
          a.canPostOn = true;
        } else if (
          areaOnIt.areasAround.includes(a.key) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;

    default:
      //don't find unit's name, default function
      newAreas = allAreas.map((a) => {
        if (areaOnIt.areasAround.includes(a.key) && !a.unitOnIt) {
          a.canPostOn = true;
        } else if (
          areaOnIt.areasAround.includes(a.key) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;
  }
  return newAreas;
}
