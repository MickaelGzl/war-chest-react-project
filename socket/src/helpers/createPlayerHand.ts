import { UnitInterface } from "../@types/interface";

/**
 * Create a hand for the player by randomly selecting 3 units in his bag
 * Carefull cause this function modify the array in params (here player's bag)
 * @param unitArray Array representing the bag of the player
 * @returns An Arrays corresponding to the hand created for the player
 */
export function createPlayerHand(unitArray: UnitInterface[]): UnitInterface[] {
  const playerHand: UnitInterface[] = [];
  const move = unitArray.length > 3 ? 3 : unitArray.length;
  for (let i = 0; i < move; i++) {
    let nb = Math.floor(Math.random() * unitArray.length);
    playerHand.push(unitArray[nb]);
    unitArray.splice(nb, 1);
  }

  return playerHand;
}
