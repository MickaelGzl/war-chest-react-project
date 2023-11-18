import { UnitInterface } from "../@types/interface";

/**
 * Remove 2 of each units in player's units to place them in his bag.
 * Carefull cause this function modify the array in params (here the player's barrack)
 * @param unitArray Array representing the units selected by the player
 * @returns An Arrays corresponding to the units in bag
 */
export function RecruitUnitsAtStart(
  unitArray: UnitInterface[]
): UnitInterface[] {
  let unitInBag: UnitInterface[] = [];

  unitArray.map((unit) => {
    if (unit.nb === 5 || unit.nb === 4) {
      unit.nb = unit.nb - 2;
      unitInBag = [...unitInBag, { ...unit, nb: 1 }, { ...unit, nb: 1 }];
    }
  });
  return unitInBag;
}
