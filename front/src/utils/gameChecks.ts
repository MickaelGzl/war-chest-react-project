import { AreaInterface, PlayerInterface, UnitInterface, UnitOnBoardInterface } from "../@types/interfaces";
import { unitIsNotOneOfPlayer } from "./verifyUnitAppartenance";
import { createMovement } from "./createMovement";

// ---------------------------------------------------------------------------
// Berserk
// ---------------------------------------------------------------------------

/** First berserk move is always free (no sacrifice needed). */
export function berserkFirstMoveIsFree(): true {
  return true;
}

/** A berserk can sacrifice a reinforcement for an extra move only if it has
 *  more than 1 reinforce (the last piece may never be sacrificed). */
export function berserkCanSacrifice(currentReinforce: number): boolean {
  return currentReinforce > 1;
}

/** After sacrificing 1 reinforce, can the berserk sacrifice again? */
export function berserkCanContinueAfterSacrifice(reinforceAfterSacrifice: number): boolean {
  return reinforceAfterSacrifice > 1;
}

/** Maximum additional moves a berserk can make from a given reinforce value
 *  (first move is free, then one per sacrifice until reinforce = 1). */
export function berserkMaxTotalMoves(startReinforce: number): number {
  // free move + (startReinforce - 1) sacrifices, but each sacrifice requires reinforce > 1
  // so max sacrifices = startReinforce - 1
  return 1 + Math.max(0, startReinforce - 1);
}

// ---------------------------------------------------------------------------
// Chevalier
// ---------------------------------------------------------------------------

/** A Chevalier can only be attacked by a unit that is reinforced (reinforce >= 2). */
export function canAttackChevalier(attackerReinforce: number): boolean {
  return attackerReinforce >= 2;
}

// ---------------------------------------------------------------------------
// Piquier
// ---------------------------------------------------------------------------

/** The Piquier counter-attacks only when the attacker is ADJACENT (1 case).
 *  Pass the Piquier's areasAround list and the attacker's area key. */
export function piquierCounterAttacks(
  attackerAreaKey: string,
  piquierAreasAround: string[]
): boolean {
  return piquierAreasAround.includes(attackerAreaKey);
}

// ---------------------------------------------------------------------------
// Fantassin
// ---------------------------------------------------------------------------

/** A Fantassin action triggers the second Fantassin's extra turn only when
 *  the action is a move or a control — NOT a reinforce or deploy. */
export function fantassinTriggersExtraTurn(
  action: "move" | "control" | "reinforce" | "deploy"
): boolean {
  return action === "move" || action === "control";
}

// ---------------------------------------------------------------------------
// Moine
// ---------------------------------------------------------------------------

/** The Moine triggers a chain draw (draw again) when its drawn unit
 *  performs an attack or a control action. */
export function moineTriggersChainDraw(
  actionType: "attack" | "control" | "move" | "deploy" | "reinforce"
): boolean {
  return actionType === "attack" || actionType === "control";
}

// ---------------------------------------------------------------------------
// Éclaireur — deployment zones around allied units
// ---------------------------------------------------------------------------

/** Returns the set of area keys where the Éclaireur can be deployed:
 *  any empty cell adjacent to a friendly unit already on the board. */
export function eclaireurDeploymentKeys(
  board: AreaInterface[],
  players: PlayerInterface[],
  playerId: number
): Set<string> {
  const player = players.find((p) => p.id === playerId)!;
  const keys = new Set<string>();
  board.forEach((area) => {
    if (area.unitOnIt && player.units.find((u) => u.id === area.unitOnIt!.id)) {
      area.areasAround.forEach((k) => {
        const neighbor = board.find((a) => a.key === k);
        if (neighbor && !neighbor.unitOnIt) keys.add(k);
      });
    }
  });
  return keys;
}

// ---------------------------------------------------------------------------
// Capitaine — allied units within 2 cases that can be ordered to attack
// ---------------------------------------------------------------------------

/** Returns the set of area keys containing allied units within 2 cases of the
 *  Capitaine (eligible for the "faire attaquer un allié" action). */
export function capitaineAllyKeys(
  captainArea: AreaInterface,
  board: AreaInterface[],
  players: PlayerInterface[],
  socketTurn: string
): Set<string> {
  const keys = new Set<string>();
  board.forEach((a) => {
    if (!a.unitOnIt) return;
    if (unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)) return; // enemy
    if (a.key === captainArea.key) return; // exclude the captain itself
    const inRange =
      captainArea.areasAround.includes(a.key) ||
      captainArea.areasAt2Cases.includes(a.key);
    if (inRange) keys.add(a.key);
  });
  return keys;
}

// ---------------------------------------------------------------------------
// Porte-Étendard — ally move destination validity
// ---------------------------------------------------------------------------

/** An ally destination is valid for the Porte-Étendard if it is:
 *  1. Adjacent to the ally being moved (1 case)
 *  2. Within 2 cases of the Porte-Étendard
 *  3. Empty */
export function isPorteEtendardDestinationValid(
  destinationKey: string,
  allyArea: AreaInterface,
  bannerArea: AreaInterface,
  board: AreaInterface[]
): boolean {
  const dest = board.find((a) => a.key === destinationKey);
  if (!dest || dest.unitOnIt) return false;
  const adjacentToAlly = allyArea.areasAround.includes(destinationKey);
  const inBannerRange =
    bannerArea.areasAround.includes(destinationKey) ||
    bannerArea.areasAt2Cases.includes(destinationKey);
  return adjacentToAlly && inBannerRange;
}

// ---------------------------------------------------------------------------
// Garde Royale — Sceau Royal destination validity
// ---------------------------------------------------------------------------

/** A destination is valid for Garde Royale movement via Sceau Royal if it is:
 *  1. Within 2 cases of the Garde Royale's current position
 *  2. Controlled by the owning player
 *  3. Empty */
export function isSceauRoyalDestinationValid(
  destinationKey: string,
  gardeRoyaleArea: AreaInterface,
  playerId: number,
  board: AreaInterface[]
): boolean {
  const dest = board.find((a) => a.key === destinationKey);
  if (!dest || dest.unitOnIt) return false;
  const inRange =
    gardeRoyaleArea.areasAround.includes(destinationKey) ||
    gardeRoyaleArea.areasAt2Cases.includes(destinationKey);
  return inRange && dest.controlledBy === playerId;
}

// ---------------------------------------------------------------------------
// Mercenaire — free action condition
// ---------------------------------------------------------------------------

/** After recruiting a Mercenaire, if another Mercenaire is already on the board
 *  belonging to the same player, a free extra action is granted. */
export function mercenaireGrantsExtraAction(
  recruitingPlayerId: number,
  board: AreaInterface[],
  players: PlayerInterface[]
): boolean {
  const player = players.find((p) => p.id === recruitingPlayerId)!;
  return board.some(
    (a) =>
      a.unitOnIt?.name === "Mercenaire" &&
      player.units.some((u) => u.id === a.unitOnIt!.id)
  );
}

// ---------------------------------------------------------------------------
// Bag / hand mechanics
// ---------------------------------------------------------------------------

/** Simulates drawing one unit from a bag.  Returns the drawn unit and the new bag. */
export function drawFromBag(
  bag: UnitInterface[],
  indexToDraw: number
): { drawn: UnitInterface; remainingBag: UnitInterface[] } {
  const drawn = bag[indexToDraw];
  const remainingBag = bag.filter((_, i) => i !== indexToDraw);
  return { drawn, remainingBag };
}

/** Removes a played unit from the player's hand, and adds it to unitOnHold
 *  (unless it was deployed to the board).  Returns the updated hand and unitOnHold. */
export function applyPlayedUnit(
  hand: UnitInterface[],
  unitOnHold: Array<UnitInterface & { unvisible?: boolean }>,
  playedUnit: UnitInterface,
  postedOnGround: boolean
): {
  hand: UnitInterface[];
  unitOnHold: Array<UnitInterface & { unvisible?: boolean }>;
} {
  const idx = hand.findIndex((u) => u.id === playedUnit.id);
  if (idx === -1) return { hand, unitOnHold }; // not in hand (e.g. extra-turn action)
  const newHand = hand.filter((_, i) => i !== idx);
  const newHold = postedOnGround
    ? unitOnHold
    : [...unitOnHold, { ...playedUnit, unvisible: true }];
  return { hand: newHand, unitOnHold: newHold };
}
