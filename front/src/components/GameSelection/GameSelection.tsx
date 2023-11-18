import styles from "./gameSelection.module.css";
import { UnitInterface } from "../../@types/interfaces";
import { useMemo } from "react";
import { GameSelectionPropsType } from "../../@types/types";
import { cardPath } from "../../utils/paths";

function GameSelection(props: GameSelectionPropsType) {
  const { socket, players, unitsSelection, socketTurn } = props;

  const selectionUnits = useMemo(() => unitsSelection, [unitsSelection]);

  /**
   * verify the user have the right to play in the current turn before change anything
   * @param unit the unit selected
   * @returns out of the function if it's not the player turn
   */
  const handleSelectUnit = (unit: UnitInterface) => {
    // console.log({ socket: socket.id, socketTurn });
    if (socket.id !== socketTurn) {
      console.log("not your turn");
      return;
    }
    socket.emit("selectUnit", unit.id);
  };

  return (
    <div className={styles.layer}>
      <div>
        <h4 className={styles.title}>
          {socket.id === socketTurn
            ? "Sélectionnez une unité"
            : "L'adversaire sélectionne une unité"}
        </h4>
        <div className={styles.selection}>
          {selectionUnits.map((unit) => (
            <div
              key={unit.id}
              onClick={() => handleSelectUnit(unit)}
              style={{
                backgroundImage: `url("${cardPath}${unit.name
                  .toLowerCase()
                  .replaceAll(" ", "_")}.gif")`,
              }}
            >
              <span>{unit.name}</span>
              <span>{`x${unit.nb}`}</span>
              <span>{unit.cap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GameSelection;
