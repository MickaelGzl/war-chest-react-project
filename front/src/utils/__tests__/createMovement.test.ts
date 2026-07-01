import { describe, it, expect, beforeEach } from "vitest";
import { createMovement } from "../createMovement";
import { createBoard } from "../createBoard";
import { AreaInterface, PlayerInterface } from "../../@types/interfaces";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Place a unit on an area identified by its key */
function placeUnit(
  areas: AreaInterface[],
  key: string,
  unitId: number,
  unitName: string
): AreaInterface[] {
  return areas.map((a) =>
    a.key === key
      ? { ...a, unitOnIt: { id: unitId, name: unitName, nb: 1, cap: "", reinforce: 1 } }
      : a
  );
}

/** Get an area by key — throws if not found so tests fail clearly */
function get(areas: AreaInterface[], key: string): AreaInterface {
  const area = areas.find((a) => a.key === key);
  if (!area) throw new Error(`Area ${key} not found on board`);
  return area;
}

/**
 * Build two mock players.
 * Player 1 (socketId "p1") owns units with IDs in p1UnitIds.
 * Player 2 (socketId "p2") owns units with IDs in p2UnitIds.
 */
function makePlayers(p1UnitIds: number[], p2UnitIds: number[]): PlayerInterface[] {
  return [
    {
      id: 1,
      socketId: "p1",
      initToken: "",
      units: p1UnitIds.map((id) => ({ id, name: "", nb: 1, cap: "" })),
      bag: [],
      hand: [],
      unitOnHold: [],
      graveyard: [],
    },
    {
      id: 2,
      socketId: "p2",
      initToken: "",
      units: p2UnitIds.map((id) => ({ id, name: "", nb: 1, cap: "" })),
      bag: [],
      hand: [],
      unitOnHold: [],
      graveyard: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Test fixture — positions around the attacker at "5_6"
//
// Hex neighbours (areasAround) of "5_6":
//   "5_4"  "5_8"  "4_5"  "4_7"  "6_5"  "6_7"
//
// Straight 2-step targets from "5_6":
//   direction (0,+2):  k1="5_8"  k2="5_10"
//   direction (0,-2):  k1="5_4"  k2="5_2"
//   direction (-1,+1): k1="4_7"  k2="3_8"
//   direction (-1,-1): k1="4_5"  k2="3_4"
//   direction (+1,+1): k1="6_7"  k2="7_8"
//   direction (+1,-1): k1="6_5"  k2="7_4"
//
// Straight 3-step target:
//   direction (0,+2):  k3="5_12"
//   direction (0,-2):  k3="5_0"
// ---------------------------------------------------------------------------

const ATTACKER = "5_6";
// Friendly unit id (belongs to player 1)
const F_ID = 10;
// Enemy unit id (belongs to player 2)
const E_ID = 20;
// Blocker id = same as friendly → treated as ally, blocks line-of-sight
const B_ID = 10;

describe("createMovement", () => {
  let board: AreaInterface[];
  let players: PlayerInterface[];

  beforeEach(() => {
    board = createBoard();
    players = makePlayers([F_ID], [E_ID]);
  });

  // =========================================================================
  // Default movement (Capitaine, Mercenaire, Berserk, Piquier, Moine,
  //                   Porte étendard, Chevalier, Garde Royale…)
  // =========================================================================
  describe("Mouvement par défaut (Capitaine, Mercenaire, Berserk, Piquier…)", () => {
    it("surligne toutes les cases adjacentes vides en vert (canPostOn)", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Capitaine");
      const result = createMovement("Capitaine", get(areas, ATTACKER), areas, players, "p1");
      for (const key of ["5_4", "5_8", "4_5", "4_7", "6_5", "6_7"]) {
        expect(get(result, key).canPostOn, `${key} should be canPostOn`).toBe(true);
      }
    });

    it("ne peut pas se déplacer vers une case occupée", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Capitaine");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Capitaine", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(false);
    });

    it("surligne les ennemis adjacents en rouge (canAttack)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Capitaine");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Capitaine", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(true);
    });

    it("ne peut pas attaquer au-delà d'1 case", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Capitaine");
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi"); // 2 cases away
      const result = createMovement("Capitaine", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(false);
    });

    it("ne peut pas attaquer une unité alliée", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Capitaine");
      areas = placeUnit(areas, "5_8", F_ID, "Allié");
      const result = createMovement("Capitaine", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(false);
    });
  });

  // =========================================================================
  // Archer — attaque à 2 cases, intermédiaire peut être occupé
  // =========================================================================
  describe("Archer", () => {
    it("se déplace d'1 case (canPostOn)", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Archer");
      const result = createMovement("Archer", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_4").canPostOn).toBe(true);
      expect(get(result, "5_8").canPostOn).toBe(true);
    });

    it("attaque à 2 cases même si l'intermédiaire est vide", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Archer");
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi"); // intermédiaire "5_8" vide
      const result = createMovement("Archer", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(true);
    });

    it("attaque à 2 cases MÊME si l'intermédiaire est occupé (règle Archer)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Archer");
      areas = placeUnit(areas, "5_8", B_ID, "Bloqueur"); // intermédiaire occupé — pas de blocage
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi");
      const result = createMovement("Archer", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(true);
    });

    it("ne peut PAS attaquer à 1 case (adjacent)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Archer");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Archer", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(false);
    });

    it("ne peut PAS attaquer un allié", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Archer");
      areas = placeUnit(areas, "5_10", F_ID, "Allié");
      const result = createMovement("Archer", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(false);
    });
  });

  // =========================================================================
  // Arbalétrier
  // =========================================================================
  describe("Arbalétrier", () => {
    it("se déplace d'1 case (canPostOn)", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Arbalétrier");
      const result = createMovement("Arbalétrier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(true);
    });

    it("attaque à 1 case (adjacent)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Arbalétrier");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Arbalétrier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(true);
    });

    it("attaque à 2 cases si l'intermédiaire est vide", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Arbalétrier");
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi"); // intermédiaire "5_8" vide
      const result = createMovement("Arbalétrier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(true);
    });

    it("ne peut PAS attaquer à 2 cases si l'intermédiaire est occupé", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Arbalétrier");
      areas = placeUnit(areas, "5_8", B_ID, "Bloqueur"); // intermédiaire occupé
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi");
      const result = createMovement("Arbalétrier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(false);
    });

    it("peut toujours attaquer à 1 case même si l'ennemi est aussi à portée à 2 cases", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Arbalétrier");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi1"); // 1 case (also blocks 5_10)
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi2");
      const result = createMovement("Arbalétrier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(true);   // 1 case → ok
      expect(get(result, "5_10").canAttack).toBe(false); // 2 cases bloqué
    });
  });

  // =========================================================================
  // Cavalerie légère
  // =========================================================================
  describe("Cavalerie légère", () => {
    it("peut se déplacer à 1 case", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Cavalerie légère");
      const result = createMovement("Cavalerie légère", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(true);
    });

    it("peut se déplacer à 2 cases", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Cavalerie légère");
      const result = createMovement("Cavalerie légère", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canPostOn).toBe(true);
    });

    it("attaque uniquement à 1 case (adjacent)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Cavalerie légère");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi1"); // 1 case
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi2"); // 2 cases — ne devrait PAS attaquer
      const result = createMovement("Cavalerie légère", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(true);
      expect(get(result, "5_10").canAttack).toBe(false);
    });

    it("ne peut pas se déplacer sur une case occupée", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Cavalerie légère");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Cavalerie légère", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(false);
    });
  });

  // =========================================================================
  // Lancier
  // =========================================================================
  describe("Lancier", () => {
    it("se déplace à 1 case (canPostOn)", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(true);
      expect(get(result, "5_4").canPostOn).toBe(true);
    });

    it("ne se déplace pas à 2 cases", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canPostOn).toBe(false);
    });

    it("attaque à 2 cases en ligne droite si l'intermédiaire est vide", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi"); // intermédiaire "5_8" vide
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(true);
    });

    it("attaque à 3 cases en ligne droite si les 2 intermédiaires sont vides", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_12", E_ID, "Ennemi"); // k1="5_8", k2="5_10" vides
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_12").canAttack).toBe(true);
    });

    it("ne peut PAS attaquer à 2 cases si l'intermédiaire est occupé", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_8", B_ID, "Bloqueur");
      areas = placeUnit(areas, "5_10", E_ID, "Ennemi");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_10").canAttack).toBe(false);
    });

    it("ne peut PAS attaquer à 3 cases si le 1er intermédiaire est occupé", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_8", B_ID, "Bloqueur"); // 1er intermédiaire
      areas = placeUnit(areas, "5_12", E_ID, "Ennemi");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_12").canAttack).toBe(false);
    });

    it("ne peut PAS attaquer à 3 cases si le 2e intermédiaire est occupé", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_10", B_ID, "Bloqueur"); // 2e intermédiaire
      areas = placeUnit(areas, "5_12", E_ID, "Ennemi");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_12").canAttack).toBe(false);
    });

    it("ne peut PAS attaquer à 1 case (adjacent)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(false);
    });

    it("attaque dans les 6 directions (tests sur 3 directions)", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Lancier");
      areas = placeUnit(areas, "3_4", E_ID, "Ennemi-NW"); // dir(-1,-1) ×2
      areas = placeUnit(areas, "7_8", E_ID, "Ennemi-SE"); // dir(+1,+1) ×2
      areas = placeUnit(areas, "5_2", E_ID, "Ennemi-W");  // dir(0,-2) ×2
      const result = createMovement("Lancier", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "3_4").canAttack).toBe(true);
      expect(get(result, "7_8").canAttack).toBe(true);
      expect(get(result, "5_2").canAttack).toBe(true);
    });
  });

  // =========================================================================
  // Soldat (phase 1 : uniquement attaque, pas de mouvement)
  // =========================================================================
  describe("Soldat", () => {
    it("montre uniquement les zones d'attaque (canAttack) quand un ennemi est adjacent", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Soldat");
      areas = placeUnit(areas, "5_8", E_ID, "Ennemi");
      const result = createMovement("Soldat", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(true);
      // Aucun déplacement en phase 1
      expect(get(result, "5_4").canPostOn).toBe(false);
      expect(get(result, "4_5").canPostOn).toBe(false);
    });

    it("ne montre aucune zone si aucun ennemi adjacent", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Soldat");
      const result = createMovement("Soldat", get(areas, ATTACKER), areas, players, "p1");
      expect(result.some((a) => a.canAttack)).toBe(false);
      expect(result.some((a) => a.canPostOn)).toBe(false);
    });

    it("n'attaque pas les alliés adjacents", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Soldat");
      areas = placeUnit(areas, "5_8", F_ID, "Allié");
      const result = createMovement("Soldat", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canAttack).toBe(false);
    });
  });

  // =========================================================================
  // Berserk (utilise le cas par défaut de createMovement)
  // =========================================================================
  describe("Berserk (mouvement par défaut)", () => {
    it("se déplace vers les cases adjacentes vides", () => {
      const areas = placeUnit(board, ATTACKER, F_ID, "Berserk");
      const result = createMovement("Berserk", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "5_8").canPostOn).toBe(true);
      expect(get(result, "4_7").canPostOn).toBe(true);
    });

    it("attaque les ennemis adjacents", () => {
      let areas = placeUnit(board, ATTACKER, F_ID, "Berserk");
      areas = placeUnit(areas, "6_7", E_ID, "Ennemi");
      const result = createMovement("Berserk", get(areas, ATTACKER), areas, players, "p1");
      expect(get(result, "6_7").canAttack).toBe(true);
    });
  });
});
