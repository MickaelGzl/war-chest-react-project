import { ModalSelectOptionPropsType, MovementTypes } from "../../@types/types";
import styles from "./modalSelectOption.module.css";

function ModalSelectOption(props: ModalSelectOptionPropsType) {
  const {
    modalSelectOption,
    updateModalSelection,
    updateAreaByMovementOfUnit,
  } = props;

  const closeModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateModalSelection(false);
  };

  const selectMovement = (e: React.MouseEvent, movement: MovementTypes) => {
    e.stopPropagation();
    updateAreaByMovementOfUnit(movement, modalSelectOption.area!);
  };

  //Déplacer should highligth all areas around
  //  then click on area ask socket to update the board
  //    move unit to the area clicked and remove unit of the previous area
  //Renforcer should increment area.unitOnIt.renforce by 1
  //Contrôler is available only if player is on area.controlPost
  //  need to verify controlPost isn't already control by the same player
  //    should update area.controllerBy with the player id <-- need to get the player id

  //click on a button send a event to BoardGame, with a value (move, reinforce, control)
  //the function on boardGame use a switch and update in function

  return (
    <div className={styles.calc} onClick={(e) => closeModal(e)}>
      <div className={styles.modal}>
        <button onClick={(e) => selectMovement(e, "move")}>Déplacer</button>
        <button onClick={(e) => selectMovement(e, "reinforce")}>
          Renforcer
        </button>
        {modalSelectOption.area?.controlPoint === true &&
          modalSelectOption.area.controlledBy !==
            modalSelectOption.playerId && (
            <button onClick={(e) => selectMovement(e, "control")}>
              Contrôler
            </button>
          )}
        <button onClick={(e) => closeModal(e)}>Annuler</button>
      </div>
    </div>
  );
}

export default ModalSelectOption;
