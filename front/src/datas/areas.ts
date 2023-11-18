// const unusedLines = [0, 1, 9, 10];
// const controlCases = [
//   "2_7",
//   "3_4",
//   "3_10",
//   "4_1",
//   "4_7",
//   "6_5",
//   "6_11",
//   "7_2",
//   "7_8",
//   "8_5",
// ];

// /**
//  * create the boardGame
//  * @returns an array of each area composing the boardGame
//  */
// function createBoard(): any[] {
//   const boardBody = [];
//   for (let i = 0; i <= 10; i++) {
//     if (unusedLines.includes(i)) {
//       continue;
//     }
//     for (let j = Math.abs(5 - i); j <= 12 - Math.abs(i - 5); j += 2) {
//       boardBody.push({
//         i,
//         j,
//         key: `${i}_${j}`,
//         controlPoint: controlCases.includes(`${i}_${j}`),
//         controlledBy: null,
//         unitOnIt: null,
//         areasAround: [
//           `${i}_${j - 2}`,
//           `${i}_${j + 2}`,
//           `${i - 1}_${j - 1}`,
//           `${i - 1}_${j + 1}`,
//           `${i + 1}_${j - 1}`,
//           `${i + 1}_${j + 1}`,
//         ],
//       });
//     }
//   }
//   return boardBody;
// }
