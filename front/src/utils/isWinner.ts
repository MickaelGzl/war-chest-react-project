import { AreaInterface } from "../@types/interfaces";

function playerWin(boardgame: AreaInterface[], i: number) {
  return boardgame.filter((b) => b.controlledBy === i).length === 6;
}

export function isWinner(boardgame: AreaInterface[]) {
  for (let i = 1; i < 3; i++) {
    if (playerWin(boardgame, i)) {
      return i;
    }
  }
  return 0;
}
