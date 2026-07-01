import { UnitInterface } from "../@types/interface";

/**
 * Remove 2 of each units in player's units to place them in his bag.
 * Carefull cause this function modify the array in params (here the player's barrack)
 * @param unitArray Array representing the units selected by the player
 * @returns An Arrays corresponding to the units in bag
 */
const SCEAU_ROYAL: UnitInterface = {
  id: 17,
  name: "Sceau Royal",
  cap: "Utilisable pour toutes les actions classiques. Si vous avez une Garde Royale sur le terrain, déplacez-la d'au maximum 2 cases vers une zone que vous contrôlez.",
  nb: 1,
};

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

  // Every player gets exactly 1 Royal Seal in their bag
  unitInBag = [...unitInBag, { ...SCEAU_ROYAL }];

  return unitInBag;
}
