import { describe, it, expect } from "vitest";
import { isWinner } from "../isWinner";
import { createBoard } from "../createBoard";
import { AreaInterface } from "../../@types/interfaces";

describe("isWinner", () => {
  it("retourne 0 quand aucun joueur ne contrôle 6 zones", () => {
    const board = createBoard();
    expect(isWinner(board)).toBe(0);
  });

  it("retourne 1 quand le joueur 1 contrôle exactement 6 zones", () => {
    // Reset all presets then set exactly 6 zones for player 1
    const board: AreaInterface[] = createBoard()
      .map((a) => ({ ...a, controlledBy: null }))
      .map((a, i) => (i < 6 ? { ...a, controlledBy: 1 } : a));
    expect(isWinner(board)).toBe(1);
  });

  it("retourne 2 quand le joueur 2 contrôle exactement 6 zones", () => {
    const board: AreaInterface[] = createBoard()
      .map((a) => ({ ...a, controlledBy: null }))
      .map((a, i) => (i < 6 ? { ...a, controlledBy: 2 } : a));
    expect(isWinner(board)).toBe(2);
  });

  it("retourne 0 quand un joueur contrôle 5 zones seulement", () => {
    const board: AreaInterface[] = createBoard()
      .map((a) => ({ ...a, controlledBy: null }))
      .map((a, i) => (i < 5 ? { ...a, controlledBy: 1 } : a));
    expect(isWinner(board)).toBe(0);
  });

  it("retourne 1 même avec plus de 6 zones contrôlées", () => {
    const board: AreaInterface[] = createBoard()
      .map((a) => ({ ...a, controlledBy: null }))
      .map((a, i) => (i < 8 ? { ...a, controlledBy: 1 } : a));
    expect(isWinner(board)).toBe(1);
  });
});
