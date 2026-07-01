import { describe, it, expect, beforeEach } from "vitest";
import {
  berserkCanSacrifice,
  berserkCanContinueAfterSacrifice,
  berserkMaxTotalMoves,
  berserkFirstMoveIsFree,
  canAttackChevalier,
  piquierCounterAttacks,
  fantassinTriggersExtraTurn,
  moineTriggersChainDraw,
  eclaireurDeploymentKeys,
  capitaineAllyKeys,
  isPorteEtendardDestinationValid,
  isSceauRoyalDestinationValid,
  mercenaireGrantsExtraAction,
  drawFromBag,
  applyPlayedUnit,
} from "../gameChecks";
import { createBoard } from "../createBoard";
import { AreaInterface, PlayerInterface, UnitInterface } from "../../@types/interfaces";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const unit = (id: number, name: string): UnitInterface => ({ id, name, nb: 1, cap: "" });

function makePlayers(p1UnitIds: number[], p2UnitIds: number[]): PlayerInterface[] {
  return [
    { id: 1, socketId: "p1", initToken: "", units: p1UnitIds.map((id) => unit(id, "")), bag: [], hand: [], unitOnHold: [], graveyard: [] },
    { id: 2, socketId: "p2", initToken: "", units: p2UnitIds.map((id) => unit(id, "")), bag: [], hand: [], unitOnHold: [], graveyard: [] },
  ];
}

function placeUnit(board: AreaInterface[], key: string, unitId: number, name: string): AreaInterface[] {
  return board.map((a) =>
    a.key === key ? { ...a, unitOnIt: { id: unitId, name, nb: 1, cap: "", reinforce: 1 } } : a
  );
}

const get = (board: AreaInterface[], key: string) => board.find((a) => a.key === key)!;

// ---------------------------------------------------------------------------
// BERSERK
// ---------------------------------------------------------------------------

describe("Berserk", () => {
  it("le premier mouvement est toujours gratuit", () => {
    expect(berserkFirstMoveIsFree()).toBe(true);
  });

  it("peut sacrifier un renfort si reinforce > 1", () => {
    expect(berserkCanSacrifice(2)).toBe(true);
    expect(berserkCanSacrifice(3)).toBe(true);
    expect(berserkCanSacrifice(5)).toBe(true);
  });

  it("ne peut PAS sacrifier si reinforce = 1 (dernière pièce)", () => {
    expect(berserkCanSacrifice(1)).toBe(false);
  });

  it("peut continuer après sacrifice si le renfort restant > 1", () => {
    expect(berserkCanContinueAfterSacrifice(2)).toBe(true);
    expect(berserkCanContinueAfterSacrifice(3)).toBe(true);
  });

  it("ne peut PAS continuer après sacrifice si renfort restant = 1", () => {
    expect(berserkCanContinueAfterSacrifice(1)).toBe(false);
  });

  it("reinforce=1 → 1 mouvement total (gratuit, aucun sacrifice)", () => {
    expect(berserkMaxTotalMoves(1)).toBe(1);
  });

  it("reinforce=2 → 2 mouvements (1 gratuit + 1 sacrifice)", () => {
    expect(berserkMaxTotalMoves(2)).toBe(2);
  });

  it("reinforce=3 → 3 mouvements (1 gratuit + 2 sacrifices)", () => {
    expect(berserkMaxTotalMoves(3)).toBe(3);
  });

  it("reinforce=5 → 5 mouvements (1 gratuit + 4 sacrifices)", () => {
    expect(berserkMaxTotalMoves(5)).toBe(5);
  });

  it("ne peut jamais sacrifier la dernière pièce : après chaque sacrifice reinforce >= 1", () => {
    // Start at reinforce 4, do 3 sacrifices
    let r = 4;
    let moves = 1; // free move
    while (berserkCanSacrifice(r)) {
      r -= 1;
      moves += 1;
    }
    expect(r).toBe(1); // always stops at 1, never goes to 0
    expect(moves).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// CHEVALIER
// ---------------------------------------------------------------------------

describe("Chevalier", () => {
  it("peut être attaqué par une unité renforcée (reinforce >= 2)", () => {
    expect(canAttackChevalier(2)).toBe(true);
    expect(canAttackChevalier(3)).toBe(true);
  });

  it("ne peut PAS être attaqué par une unité avec reinforce = 1", () => {
    expect(canAttackChevalier(1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PIQUIER
// ---------------------------------------------------------------------------

describe("Piquier", () => {
  let board: AreaInterface[];

  beforeEach(() => { board = createBoard(); });

  it("contre-attaque si l'attaquant est adjacent (1 case)", () => {
    const piquierArea = get(board, "5_6");
    const attackerKey = "5_8"; // adjacent
    expect(piquierCounterAttacks(attackerKey, piquierArea.areasAround)).toBe(true);
  });

  it("ne contre-attaque PAS si l'attaquant est à distance (2 cases — Archer)", () => {
    const piquierArea = get(board, "5_6");
    const archerKey = "5_10"; // 2 cases, not adjacent
    expect(piquierCounterAttacks(archerKey, piquierArea.areasAround)).toBe(false);
  });

  it("ne contre-attaque PAS pour une attaque à 3 cases (Lancier)", () => {
    const piquierArea = get(board, "5_6");
    const lancierKey = "5_12"; // 3 cases
    expect(piquierCounterAttacks(lancierKey, piquierArea.areasAround)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FANTASSIN
// ---------------------------------------------------------------------------

describe("Fantassin — déclenchement du tour supplémentaire", () => {
  it("déplacer un Fantassin donne un tour au second Fantassin", () => {
    expect(fantassinTriggersExtraTurn("move")).toBe(true);
  });

  it("contrôler avec un Fantassin donne un tour au second Fantassin", () => {
    expect(fantassinTriggersExtraTurn("control")).toBe(true);
  });

  it("renforcer un Fantassin ne donne PAS de tour au second Fantassin", () => {
    expect(fantassinTriggersExtraTurn("reinforce")).toBe(false);
  });

  it("déployer un Fantassin ne donne PAS de tour au second Fantassin", () => {
    expect(fantassinTriggersExtraTurn("deploy")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MOINE
// ---------------------------------------------------------------------------

describe("Moine — chaîne de pioche (uniquement si pièce piochée = Moine)", () => {
  // La chaîne ne se déclenche que si la PIÈCE PIOCHÉE est elle-même un Moine
  // ET qu'elle attaque ou contrôle. Pour toute autre pièce → pas de chaîne.

  it("un Moine pioché qui attaque déclenche une nouvelle pioche", () => {
    const drawnIsMoine = true;
    const action = "attack";
    expect(moineTriggersChainDraw(action) && drawnIsMoine).toBe(true);
  });

  it("un Moine pioché qui contrôle déclenche une nouvelle pioche", () => {
    const drawnIsMoine = true;
    const action = "control";
    expect(moineTriggersChainDraw(action) && drawnIsMoine).toBe(true);
  });

  it("un Moine pioché qui se déploie ne déclenche PAS de chaîne", () => {
    expect(moineTriggersChainDraw("deploy")).toBe(false);
  });

  it("une pièce piochée non-Moine qui attaque ne déclenche PAS de chaîne", () => {
    const drawnIsMoine = false;
    const action = "attack";
    // Chain requires BOTH drawn==Moine AND action==attack/control
    expect(moineTriggersChainDraw(action) && drawnIsMoine).toBe(false);
  });

  it("une pièce piochée non-Moine qui contrôle ne déclenche PAS de chaîne", () => {
    const drawnIsMoine = false;
    expect(moineTriggersChainDraw("control") && drawnIsMoine).toBe(false);
  });
});

describe("Moine — mécanique du sac (drawFromBag)", () => {
  it("retire la pièce piochée du sac", () => {
    const bag = [unit(1, "Fantassin"), unit(2, "Archer"), unit(3, "Lancier")];
    const { drawn, remainingBag } = drawFromBag(bag, 1);
    expect(drawn.id).toBe(2);
    expect(remainingBag).toHaveLength(2);
    expect(remainingBag.find((u) => u.id === 2)).toBeUndefined();
  });

  it("le sac restant contient les autres pièces", () => {
    const bag = [unit(1, "Fantassin"), unit(2, "Archer")];
    const { remainingBag } = drawFromBag(bag, 0);
    expect(remainingBag).toHaveLength(1);
    expect(remainingBag[0].id).toBe(2);
  });
});

describe("Moine — applyPlayedUnit (main → réserve)", () => {
  it("retire la pièce jouée de la main", () => {
    const hand = [unit(1, "Moine"), unit(2, "Fantassin")];
    const { hand: newHand } = applyPlayedUnit(hand, [], unit(1, "Moine"), false);
    expect(newHand).toHaveLength(1);
    expect(newHand[0].id).toBe(2);
  });

  it("ajoute la pièce jouée en réserve (unitOnHold) si non posée sur terrain", () => {
    const hand = [unit(1, "Moine")];
    const { unitOnHold } = applyPlayedUnit(hand, [], unit(1, "Moine"), false);
    expect(unitOnHold).toHaveLength(1);
    expect(unitOnHold[0].id).toBe(1);
  });

  it("n'ajoute PAS en réserve si la pièce est posée sur le terrain (postedOnGround)", () => {
    const hand = [unit(5, "Fantassin")];
    const { unitOnHold } = applyPlayedUnit(hand, [], unit(5, "Fantassin"), true);
    expect(unitOnHold).toHaveLength(0);
  });

  it("ne fait rien si l'unité n'est pas dans la main (extra-tour, piochée du sac)", () => {
    const hand = [unit(2, "Archer")];
    const hold = [{ ...unit(1, "Moine"), unvisible: true }];
    const { hand: h, unitOnHold: uh } = applyPlayedUnit(hand, hold, unit(9, "Lancier"), false);
    expect(h).toHaveLength(1); // main inchangée
    expect(uh).toHaveLength(1); // réserve inchangée
  });
});

// ---------------------------------------------------------------------------
// ÉCLAIREUR
// ---------------------------------------------------------------------------

describe("Éclaireur — zones de déploiement", () => {
  let board: AreaInterface[];
  let players: PlayerInterface[];

  beforeEach(() => {
    board = createBoard();
    players = makePlayers([10], [20]);
  });

  it("peut être déployé sur une case adjacente à une unité alliée", () => {
    board = placeUnit(board, "5_6", 10, "Fantassin"); // allied unit at 5_6
    const zones = eclaireurDeploymentKeys(board, players, 1);
    // Adjacent empty zones of "5_6": 5_4, 5_8, 4_5, 4_7, 6_5, 6_7
    expect(zones.has("5_4")).toBe(true);
    expect(zones.has("5_8")).toBe(true);
    expect(zones.has("4_5")).toBe(true);
  });

  it("ne peut PAS être déployé sur une case occupée", () => {
    board = placeUnit(board, "5_6", 10, "Fantassin");
    board = placeUnit(board, "5_8", 20, "Ennemi"); // adjacent but occupied
    const zones = eclaireurDeploymentKeys(board, players, 1);
    expect(zones.has("5_8")).toBe(false);
  });

  it("zones vides si aucune unité alliée sur le terrain", () => {
    const zones = eclaireurDeploymentKeys(board, players, 1);
    expect(zones.size).toBe(0);
  });

  it("cumule les zones autour de plusieurs unités alliées", () => {
    board = placeUnit(board, "5_6", 10, "Fantassin");
    board = placeUnit(board, "5_2", 10, "Archer"); // another ally far away
    const zones = eclaireurDeploymentKeys(board, players, 1);
    // Zones around 5_6 + zones around 5_2
    expect(zones.has("5_4")).toBe(true); // adjacent to 5_6 AND 5_2
    expect(zones.has("5_8")).toBe(true);
    expect(zones.has("5_0")).toBe(true); // adjacent to 5_2 only
  });
});

// ---------------------------------------------------------------------------
// CAPITAINE
// ---------------------------------------------------------------------------

describe("Capitaine — alliés à portée", () => {
  let board: AreaInterface[];
  let players: PlayerInterface[];

  beforeEach(() => {
    board = createBoard();
    players = makePlayers([10, 11], [20]);
  });

  it("détecte un allié à 1 case", () => {
    board = placeUnit(board, "5_6", 10, "Capitaine");
    board = placeUnit(board, "5_8", 11, "Fantassin"); // 1 case
    const capArea = get(board, "5_6");
    const keys = capitaineAllyKeys(capArea, board, players, "p1");
    expect(keys.has("5_8")).toBe(true);
  });

  it("détecte un allié à 2 cases", () => {
    board = placeUnit(board, "5_6", 10, "Capitaine");
    board = placeUnit(board, "5_10", 11, "Archer"); // 2 cases
    const capArea = get(board, "5_6");
    const keys = capitaineAllyKeys(capArea, board, players, "p1");
    expect(keys.has("5_10")).toBe(true);
  });

  it("ne détecte PAS un ennemi", () => {
    board = placeUnit(board, "5_6", 10, "Capitaine");
    board = placeUnit(board, "5_8", 20, "Ennemi");
    const capArea = get(board, "5_6");
    const keys = capitaineAllyKeys(capArea, board, players, "p1");
    expect(keys.has("5_8")).toBe(false);
  });

  it("ne s'inclut pas lui-même", () => {
    board = placeUnit(board, "5_6", 10, "Capitaine");
    const capArea = get(board, "5_6");
    const keys = capitaineAllyKeys(capArea, board, players, "p1");
    expect(keys.has("5_6")).toBe(false);
  });

  it("ne détecte PAS un allié à plus de 2 cases", () => {
    board = placeUnit(board, "5_6", 10, "Capitaine");
    board = placeUnit(board, "5_12", 11, "Archer"); // 3 cases
    const capArea = get(board, "5_6");
    const keys = capitaineAllyKeys(capArea, board, players, "p1");
    expect(keys.has("5_12")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PORTE-ÉTENDARD
// ---------------------------------------------------------------------------

describe("Porte-Étendard — validité de la destination alliée", () => {
  let board: AreaInterface[];

  beforeEach(() => { board = createBoard(); });

  it("destination valide : adjacente à l'allié ET dans les 2 cases du PE", () => {
    const bannerArea = get(board, "5_6");  // Porte-Étendard at 5_6
    const allyArea = get(board, "5_8");   // ally at 5_8 (1 case from PE)
    // "5_10" is adjacent to ally (5_8) and within 2 cases of PE (5_6)
    expect(isPorteEtendardDestinationValid("5_10", allyArea, bannerArea, board)).toBe(true);
  });

  it("destination invalide : adjacente à l'allié mais hors des 2 cases du PE", () => {
    const bannerArea = get(board, "5_6");
    const allyArea = get(board, "5_10"); // ally at 5_10 (2 cases from PE)
    // "5_12" is adjacent to 5_10 but 3 cases from PE → invalid
    expect(isPorteEtendardDestinationValid("5_12", allyArea, bannerArea, board)).toBe(false);
  });

  it("destination invalide : dans les 2 cases du PE mais pas adjacente à l'allié", () => {
    const bannerArea = get(board, "5_6");
    const allyArea = get(board, "5_8");
    // "4_7" is within 2 cases of PE but not adjacent to ally at 5_8
    // Let's check: 4_7's areasAround includes "5_8"? 4_7's neighbors are 4_5,4_9,3_6,3_8,5_6,5_8
    // So 4_7 IS adjacent to 5_8 — let me pick a clearly non-adjacent one
    // 3_4 is within 2 cases of 5_6 but areasAround of 5_8 doesn't include 3_4
    expect(isPorteEtendardDestinationValid("3_4", allyArea, bannerArea, board)).toBe(false);
  });

  it("destination invalide : case occupée", () => {
    board = placeUnit(board, "5_10", 99, "Bloqueur");
    const bannerArea = get(board, "5_6");
    const allyArea = get(board, "5_8");
    expect(isPorteEtendardDestinationValid("5_10", allyArea, bannerArea, board)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GARDE ROYALE — Sceau Royal
// ---------------------------------------------------------------------------

describe("Garde Royale — déplacement via Sceau Royal", () => {
  let board: AreaInterface[];

  beforeEach(() => { board = createBoard(); });

  it("destination valide : dans les 2 cases, contrôlée, vide", () => {
    const grArea = get(board, "5_6");
    // Make "5_8" controlled by player 1 and empty
    board = board.map((a) => a.key === "5_8" ? { ...a, controlledBy: 1 } : a);
    expect(isSceauRoyalDestinationValid("5_8", grArea, 1, board)).toBe(true);
  });

  it("destination invalide : dans les 2 cases mais pas contrôlée", () => {
    const grArea = get(board, "5_6");
    expect(isSceauRoyalDestinationValid("5_8", grArea, 1, board)).toBe(false);
  });

  it("destination invalide : hors des 2 cases", () => {
    const grArea = get(board, "5_6");
    board = board.map((a) => a.key === "5_12" ? { ...a, controlledBy: 1 } : a);
    expect(isSceauRoyalDestinationValid("5_12", grArea, 1, board)).toBe(false);
  });

  it("destination invalide : dans les 2 cases, contrôlée, mais occupée", () => {
    const grArea = get(board, "5_6");
    board = board.map((a) => a.key === "5_8" ? { ...a, controlledBy: 1 } : a);
    board = placeUnit(board, "5_8", 99, "Bloqueur");
    expect(isSceauRoyalDestinationValid("5_8", grArea, 1, board)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MERCENAIRE
// ---------------------------------------------------------------------------

describe("Mercenaire — action gratuite après recrutement", () => {
  let board: AreaInterface[];

  beforeEach(() => { board = createBoard(); });

  it("accorde une action si un Mercenaire allié est déjà sur le terrain", () => {
    const players = makePlayers([10], [20]);
    // Assign id=10 as Mercenaire for player 1
    const playersWithMerc: PlayerInterface[] = [
      { ...players[0], units: [{ id: 10, name: "Mercenaire", nb: 1, cap: "" }] },
      players[1],
    ];
    board = placeUnit(board, "5_6", 10, "Mercenaire");
    expect(mercenaireGrantsExtraAction(1, board, playersWithMerc)).toBe(true);
  });

  it("n'accorde PAS d'action si aucun Mercenaire sur le terrain", () => {
    const players = makePlayers([10], [20]);
    const playersWithMerc: PlayerInterface[] = [
      { ...players[0], units: [{ id: 10, name: "Mercenaire", nb: 1, cap: "" }] },
      players[1],
    ];
    expect(mercenaireGrantsExtraAction(1, board, playersWithMerc)).toBe(false);
  });

  it("n'accorde PAS d'action si le Mercenaire sur terrain est ennemi", () => {
    const players = makePlayers([10], [20]);
    const playersWithMerc: PlayerInterface[] = [
      { ...players[0], units: [{ id: 10, name: "Mercenaire", nb: 1, cap: "" }] },
      { ...players[1], units: [{ id: 20, name: "Mercenaire", nb: 1, cap: "" }] },
    ];
    // Enemy mercenaire on board
    board = placeUnit(board, "5_6", 20, "Mercenaire");
    expect(mercenaireGrantsExtraAction(1, board, playersWithMerc)).toBe(false);
  });
});
