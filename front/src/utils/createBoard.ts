const unusedLines = [0, 1, 9, 10];
const controlCases = [
  "2_7",
  "3_4",
  "3_10",
  "4_1",
  "4_7",
  "6_5",
  "6_11",
  "7_2",
  "7_8",
  "8_5",
];

/**
 * create the boardGame
 * @returns an array of each area composing the boardGame
 */
export function createBoard(): any[] {
  const boardBody = [];
  let cpt = 0;
  for (let i = 0; i <= 10; i++) {
    if (unusedLines.includes(i)) {
      continue;
    }
    for (let j = Math.abs(5 - i); j <= 12 - Math.abs(i - 5); j += 2) {
      const key = `${i}_${j}`;
      boardBody.push({
        id: cpt++,
        i,
        j,
        key,
        controlPoint: controlCases.includes(key),
        controlledBy: ["3_10", "6_11"].includes(key)
          ? 1
          : ["4_1", "7_2"].includes(key)
          ? 2
          : null,
        unitOnIt: null,
        canPostOn: false,
        areasAround: [
          `${i}_${j - 2}`,
          `${i}_${j + 2}`,
          `${i - 1}_${j - 1}`,
          `${i - 1}_${j + 1}`,
          `${i + 1}_${j - 1}`,
          `${i + 1}_${j + 1}`,
        ],
        areasAt2Cases: [
          `${i}_${j - 4}`,
          `${i}_${j + 4}`,
          `${i - 1}_${j - 3}`,
          `${i - 1}_${j + 3}`,
          `${i + 1}_${j - 3}`,
          `${i + 1}_${j + 3}`,
          `${i - 2}_${j - 2}`,
          `${i - 2}_${j + 2}`,
          `${i + 2}_${j - 2}`,
          `${i + 2}_${j + 2}`,
          `${i + 2}_${j}`,
          `${i - 2}_${j}`,
        ],
        canAttack: false,
      });
    }
  }
  return boardBody;
}
