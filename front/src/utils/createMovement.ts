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
      // Movement: 1 adjacent case. Attack: exactly 2 cases (intermediate may be occupied)
      newAreas = allAreas.map((a) => {
        if (areaOnIt.areasAround.includes(a.key) && !a.unitOnIt) {
          a.canPostOn = true;
        } else if (
          areaOnIt.areasAt2Cases.includes(a.key) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;

    case "Arbalétrier": {
      // Movement + 1-case attack
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
      // 2-case attack: straight line only, intermediate must be empty
      const arbaletDirs: [number, number][] = [[0,2],[0,-2],[-1,1],[-1,-1],[1,1],[1,-1]];
      for (const [di, dj] of arbaletDirs) {
        const k1 = `${areaOnIt.i + di}_${areaOnIt.j + dj}`;
        const k2 = `${areaOnIt.i + 2 * di}_${areaOnIt.j + 2 * dj}`;
        const a1 = allAreas.find((a) => a.key === k1);
        const a2 = allAreas.find((a) => a.key === k2);
        if (
          a1 && !a1.unitOnIt &&
          a2 && a2.unitOnIt &&
          unitIsNotOneOfPlayer(a2.unitOnIt, players, socketTurn)
        ) {
          newAreas = newAreas.map((a) => (a.key === k2 ? { ...a, canAttack: true } : a));
        }
      }
      break;
    }

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

    case "Soldat":
      // Phase 1 shows only attack zones — movement is shown after attack via pendingAction
      newAreas = allAreas.map((a) => {
        if (
          areaOnIt.areasAround.includes(a.key) &&
          a.unitOnIt &&
          unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
        ) {
          a.canAttack = true;
        }
        return a;
      });
      break;

    case "Lancier": {
      // Movement: 1 case standard
      newAreas = allAreas.map((a) => {
        if (areaOnIt.areasAround.includes(a.key) && !a.unitOnIt) {
          a.canPostOn = true;
        }
        return a;
      });
      // Attack: 2 or 3 cases in strict straight line (all intermediate cells free)
      const directions: [number, number][] = [
        [0, 2], [0, -2], [-1, 1], [-1, -1], [1, 1], [1, -1],
      ];
      for (const [di, dj] of directions) {
        const k1 = `${areaOnIt.i + di}_${areaOnIt.j + dj}`;
        const k2 = `${areaOnIt.i + 2 * di}_${areaOnIt.j + 2 * dj}`;
        const k3 = `${areaOnIt.i + 3 * di}_${areaOnIt.j + 3 * dj}`;
        const a1 = allAreas.find((a) => a.key === k1);
        const a2 = allAreas.find((a) => a.key === k2);
        const a3 = allAreas.find((a) => a.key === k3);
        if (
          a1 && !a1.unitOnIt &&
          a2 && a2.unitOnIt &&
          unitIsNotOneOfPlayer(a2.unitOnIt, players, socketTurn)
        ) {
          newAreas = newAreas.map((a) =>
            a.key === k2 ? { ...a, canAttack: true } : a
          );
        }
        if (
          a1 && !a1.unitOnIt &&
          a2 && !a2.unitOnIt &&
          a3 && a3.unitOnIt &&
          unitIsNotOneOfPlayer(a3.unitOnIt, players, socketTurn)
        ) {
          newAreas = newAreas.map((a) =>
            a.key === k3 ? { ...a, canAttack: true } : a
          );
        }
      }
      break;
    }

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
