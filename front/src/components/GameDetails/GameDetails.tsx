import { useMemo } from "react";
import { GameDetailsPropsType } from "../../@types/types";
import styles from "./gameDetails.module.css";
import { tokenPath } from "../../utils/paths";

function GameDetails(props: GameDetailsPropsType) {
  const { players, socketTurn, socket } = props;

  const playerNumber = useMemo(
    () => (socket.id === players[0].socketId ? 1 : 2),
    [socket.id]
  );

  const onHoldUnits = useMemo(() => {
    const p1UnitsOnHold = makeHoldUnits(0);
    const p2UnitsOnHold = makeHoldUnits(1);
    return [p1UnitsOnHold, p2UnitsOnHold];
  }, [players]);

  function makeHoldUnits(nb: number) {
    const unitsToReturn: { name: string; nb: number }[] = [];
    players[nb].unitOnHold.forEach((unit) => {
      if (unit.unvisible && playerNumber !== nb + 1) {
        const sameUnit = unitsToReturn.find(
          (elem) => elem.name === "hidden_token"
        );
        if (sameUnit) {
          sameUnit.nb += 1;
        } else {
          unitsToReturn.push({ name: "hidden_token", nb: 1 });
        }
      } else {
        const sameUnit = unitsToReturn.find((elem) => elem.name === unit.name);
        if (sameUnit) {
          sameUnit.nb += 1;
        } else {
          unitsToReturn.push({ name: unit.name, nb: 1 });
        }
      }
    });
    return unitsToReturn;
  }

  const getTokenSrc = (unitName: string, playerIdx: 1 | 2): string => {
    if (unitName === "Sceau Royal") return `${tokenPath}p${playerIdx}_royal_token.png`;
    return `${tokenPath}${unitName.toLowerCase().replaceAll(" ", "_")}.png`;
  };

  return (
    <div className={styles.details}>
      <div>
        <h4>
          Vous êtes joueur {playerNumber}. Votre zone de jeu se situe en{" "}
          {playerNumber === 1 ? "bas" : "haut"} du plateau.
        </h4>
        <span>
          {socket.id === socketTurn
            ? "A vous de jouer"
            : "Tour de votre adversaire..."}
        </span>
      </div>
      <div>
        {onHoldUnits[1].map((unit, index) => (
          <div className={styles.unitOnHold} key={index}>
            <img
              src={getTokenSrc(unit.name, 2)}
              alt={unit.name}
            />
            <span>{unit.nb}</span>
          </div>
        ))}
      </div>
      <div>
        {players[1].graveyard.map((lostedUnit, index) => (
          <div className={styles.unitOnHold} key={index}>
            <img
              src={getTokenSrc(lostedUnit.name, 2)}
              alt={lostedUnit.name}
            />
            <span>{lostedUnit.nb}</span>
          </div>
        ))}
      </div>
      <div>
        {onHoldUnits[0].map((unit, index) => (
          <div className={styles.unitOnHold} key={index}>
            <img
              src={getTokenSrc(unit.name, 1)}
              alt={unit.name}
            />
            <span>{unit.nb}</span>
          </div>
        ))}
      </div>
      <div>
        {players[0].graveyard.map((lostedUnit, index) => (
          <div className={styles.unitOnHold} key={index}>
            <img
              src={getTokenSrc(lostedUnit.name, 1)}
              alt={lostedUnit.name}
            />
            <span>{lostedUnit.nb}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameDetails;
