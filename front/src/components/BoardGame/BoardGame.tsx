import { useEffect, useState } from "react";
import { BoardGamePropsType, MovementTypes } from "../../@types/types";
import { tokenPath } from "../../utils/paths";
import styles from "./boardGame.module.css";
import {
  AreaInterface,
  UnitInterface,
  UnitOnBoardInterface,
} from "../../@types/interfaces";
import ModalSelectOption from "../ModalSelectOption/ModalSelectOption";
import { unitIsNotOneOfPlayer } from "../../utils/verifyUnitAppartenance";
import { createMovement } from "../../utils/createMovement";
import { isWinner } from "../../utils/isWinner";
// import { createBoard } from "../../utils/createBoard";

function BoardGame(props: BoardGamePropsType) {
  const {
    players,
    startGame,
    boardGame,
    initiative,
    initAlreadyStole,
    socket,
    socketTurn,
    updateMessages,
    // playerReTurn,
  } = props;

  const [modalSelectOption, setModalSelectOption] = useState<{
    active: boolean;
    area?: AreaInterface;
    playerId?: number;
  }>({ active: false });
  const [areas, setAreas] = useState<AreaInterface[]>([]);
  // const boardBody = useMemo(() => areas, [areas]);
  const [selectedUnit, setSelectedUnit] = useState<
    { unit: UnitInterface; index: number } | undefined
  >();

  useEffect(() => {
    if (isWinner(boardGame) !== 0) {
      console.log(`Player ${isWinner(boardGame)} win !!!`);
    }
    // console.log('new Turn, previous: ', modalSelectOption)
    boardGame.forEach((b) => {
      if (b.unitOnIt && !b.unitOnIt.name) {
        console.log("Erreur sur cette case: ", b);
      }
    });
    setAreas(boardGame);
    // if (playerReTurn) {
    //   const otherArea = boardGame
    //     .filter((b) => b.id !== modalSelectOption.area!.id)
    //     .find((b) => b.unitOnIt!.name === "Fantassin")!;
    //   setAreas(
    //     [...boardGame.filter((b) => b.id !== otherArea.id), otherArea].sort(
    //       (a, b) => a.id - b.id
    //     )
    //   );
    //   openModalOption(otherArea);
    // } else {
    //   setModalSelectOption({ active: false });
    // }
  }, [boardGame]);

  // useEffect(() => {
  //   if (playerReTurn[0]) {
  //     const otherArea = boardGame
  //       .filter((b) => b.id !== playerReTurn[1])
  //       .find((b) => b.unitOnIt!.name === "Fantassin")!;
  //     setAreas(
  //       [...boardGame.filter((b) => b.id !== otherArea.id), otherArea].sort(
  //         (a, b) => a.id - b.id
  //       )
  //     );
  //     openModalOption(otherArea);
  //   } else {
  //     setModalSelectOption({ active: false });
  //   }
  // }, [playerReTurn]);

  const closeModal = () => {
    setModalSelectOption({ active: false });
  };

  //game function
  //all event verify that it's the player turn and if the player have the right to click on the token with the 2 first functions

  /**
   * verify that the player who make a move can play right now
   * @returns a boolean value for the condition above
   */
  function isPlayerTurn(): boolean {
    return socket.id === socketTurn;
  }

  /**
   * vérify the player acting is the one possessing the unit clicked
   * @param playerSocketId  the player onwer of the unit clicked
   * @returns a boolean value for the condition above
   */
  function isPlayerProperty(playerSocketId: string): boolean {
    return socket.id === playerSocketId;
  }

  // const updateSelectedUnit = (
  //   unit: UnitInterface,
  //   index: number,
  //   playerId: number
  // ) => {
  //   if (
  //     //update board canPost on when select an unit for the first time
  //     //also update when select éclaireur cause they can be posted in différent places
  //     !selectedUnit ||
  //     (selectedUnit.unit.name === "Éclaireur" && unit.name !== "Éclaireur") ||
  //     (unit.name === "Éclaireur" && selectedUnit.unit.name !== "Éclaireur")
  //   ) {
  //     const newAreas = areas.map((area) => {
  //       if (
  //         area.controlledBy === playerId &&
  //         !area.unitOnIt &&
  //         !areas.find((a) => a.unitOnIt?.name === unit.name)
  //       ) {
  //         area.canPostOn = true;
  //       }
  //       return area;
  //     });
  //     setAreas(newAreas.sort((a, b) => a.id - b.id));
  //   }
  //   setSelectedUnit({ unit, index });
  // };

  const updateSelectedUnit = (
    unit: UnitInterface,
    index: number,
    playerId: number
  ) => {
    //when select an unit, find if a simillary unit is already on board
    const areaWithSameUnit = areas.find((a) => a.unitOnIt?.name === unit.name);
    let newAreas = areas.map((area) => {
      area.canPostOn = false;
      area.canAttack = false;
      return area;
    });
    //if no unit posted, or if only 1 Fantassin posted
    if (
      !areaWithSameUnit ||
      (unit.name === "Fantassin" &&
        newAreas.findIndex((a) => a.unitOnIt?.name === "Fantassin") ===
          newAreas.findLastIndex((a) => a.unitOnIt?.name === "Fantassin"))
    ) {
      //if not, update area.canPostOn, where area is control by player and no unit is on area
      newAreas = newAreas.map((area) => {
        if (area.controlledBy === playerId && !area.unitOnIt) {
          area.canPostOn = true;
        }
        return area;
      });
      //need another update if unit selected is "Éclaireur"
      if (unit.name === "Éclaireur") {
        const playerWhoPlay = players.find((player) => player.id === playerId)!;
        //find all areas where player have an unit
        newAreas.forEach((area) => {
          if (
            area.unitOnIt &&
            playerWhoPlay.units.find((unit) => unit.id === area.unitOnIt?.id)
          ) {
            area.areasAround.forEach((areaKey) => {
              const areaToUpdate = newAreas.find(
                (area) => area.key === areaKey
              );
              if (areaToUpdate) {
                areaToUpdate.canPostOn = true;
              }
            });
          }
        });
      }
      setAreas(newAreas.sort((a, b) => a.id - b.id));
    }
    //need another if cause Fantassin can enter the condition before and here too
    //this is make in img on div area directly

    setSelectedUnit({ unit, index });
  };

  function openModalOption(
    area: AreaInterface,
    e?: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) {
    if (e) {
      e.stopPropagation();
    }
    setModalSelectOption({
      active: true,
      area,
      playerId: players.find((p) => p.socketId === socketTurn)!.id,
    });
    // console.log("can choose between  Déplacer, Contrôller, Renforcer, Annuler");
  }

  function endTurn() {
    if (modalSelectOption.active || modalSelectOption.area) {
      setModalSelectOption({ active: false });
    }
    setSelectedUnit(undefined);
    setAreas(
      areas
        .map((area) => {
          return { ...area, canPostOn: false };
        })
        .sort((a, b) => a.id - b.id)
    );
  }

  const pass = () => {
    if (!selectedUnit) {
      console.log(
        "vous devez sélectionner une unité dans votre main avant de jouer"
      );
      return;
    }
    // console.log(
    //   "player selectedUnit and pass turn",
    //   "both: player pass and socketTurn change, dont forget to increase turn number",
    //   "just here, setSelectedUnit to undefined"
    // );
    socket.emit("pass", selectedUnit.unit);
    endTurn();
  };

  /**
   * ask to stole unit with selected unit.
   * @param actualOwnerSocketId
   * @returns cancel if it's not player turn
   */
  const stoleInit = () => {
    if (!selectedUnit) {
      console.log(
        "vous devez sélectionner une unité dans votre main avant de jouer"
      );
      return;
    }
    if (initAlreadyStole === true) {
      updateMessages({
        content: "L'initiative à déjà été volée pour ce tour",
        date: new Date().getTime(),
      });
      return;
    }
    socket.emit("stoleInit", selectedUnit.unit);
    endTurn();
  };

  const recruitUnit = (recrutedUnit: UnitInterface) => {
    if (!selectedUnit) {
      console.log(
        "vous devez sélectionner une unité dans votre main avant de jouer"
      );
      return;
    }
    if (recrutedUnit.nb === 0) {
      updateMessages({
        content: "Vous n'avez plus d'unité de ce type à recruter",
        date: new Date().getTime(),
      });
      return;
    }
    socket.emit("recrutUnit", recrutedUnit, selectedUnit.unit);
    endTurn();
  };

  //concern move in board. player turn and selectedUnit is verified
  //pose or move, reinforce, control
  const handleClickOnArea = (area: AreaInterface) => {
    // console.log("here");
    if (!selectedUnit) {
      return;
    }
    //create a const to verify if Berserk can play again
    //for Fantassin, is it really the better method ? no
    // const canPlayAnotherTurn =
    //   modalSelectOption.area?.unitOnIt?.name === "Berserk" &&
    //   modalSelectOption.area?.unitOnIt?.reinforce > 1;

    //for Fantassin a state, =false ,and useEffect qui met direct selectedUnit sur Fantassin, la position sur l'autre zone ou se trouve le fantassin, et la modalselectOption
    //donc cache la main car il peut pas cliquer dessus, cache aussi le init token
    //le state false au dessus passe true, le fantasin est à son dernier tour. Pour le berserk, c'est tant que son reinforce > 1, mais peut annuler
    //state true masque aussi les place des joeurs avec un absolute dessus qui empeche de cliquer
    // et le bouton annuler de la modal while state true annule vraiment le tour
    //c'est gros mais c'est faisable

    if (area.canPostOn && !area.unitOnIt) {
      // console.log("area in clickedArea: ", modalSelectOption.area);
      console.log("Board 272: post unit: ", selectedUnit);
      socket.emit(
        "postUnitOnGameBoard",
        area.id,
        selectedUnit.unit,
        modalSelectOption.area?.id
      );
    } else if (area.canAttack) {
      //putain ici fantassin mais si fantassin attaque un chavalier ou un piquier.... c'est horrible
      if (
        area.unitOnIt!.name === "Chevalier" &&
        modalSelectOption.area!.unitOnIt!.reinforce < 2
      ) {
        return console.log(
          "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée"
        );
      } else if (area.unitOnIt!.name === "Piquier") {
        socket.emit(
          "attackAndSacrifice",
          area.id,
          selectedUnit.unit,
          modalSelectOption.area!.id
        );
      } else {
        socket.emit(
          "attackUnit",
          area.id,
          selectedUnit.unit,
          modalSelectOption.area!.id
        );
      }
    } else {
      console.log("unknwon movement");
      return;
    }
    endTurn();
  };

  const updateAreaByMovementOfUnit = (
    movement: MovementTypes,
    area: AreaInterface
  ) => {
    // console.log("area on switch: ", area);
    switch (movement) {
      case "move":
        const newAreas = createMovement(
          area.unitOnIt!.name,
          area,
          areas,
          players,
          socketTurn
        );
        setModalSelectOption({ ...modalSelectOption, active: false });
        setAreas(newAreas);
        break;
      case "reinforce":
        // console.log("find area by id, unitOnIt.rein");
        socket.emit("reinforceUnit", area.id, selectedUnit!.unit);
        endTurn();
        break;
      case "control":
        // console.log(
        //   "area.controlledBy take the id of the player who play and socket update render"
        // );
        socket.emit("controlArea", area.id, selectedUnit!.unit);
        endTurn();
        break;
      default:
        console.log("unknown movement");
        return;
    }
  };

  return (
    <div className={styles.boardGame}>
      <img src="images/Board_2P.png" alt="plateau de jeu" />
      {areas.map((area) => (
        <div
          key={area.key}
          onClick={() =>
            isPlayerTurn() &&
            selectedUnit != undefined &&
            handleClickOnArea(area)
          }
          className={`
            ${styles.gameArea} 
            ${styles[`l${area.i}`]} 
            ${styles[`t${area.j}`]} 
            ${
              area.controlPoint &&
              area.controlledBy != null &&
              styles[`controlledBy${area.controlledBy}`]
            }
            ${area.canPostOn && styles.highlighten}
            ${area.canAttack && styles.highlightenRed}
          `}
        >
          {area.unitOnIt && (
            <img
              src={`${tokenPath}${area.unitOnIt.name
                .toLowerCase()
                .replaceAll(" ", "_")}.png`}
              alt={area.unitOnIt.name}
              className={`${styles.boardToken} ${
                area.unitOnIt.name === selectedUnit?.unit.name &&
                styles.selectedUnit
              }`}
              onClick={(e) =>
                area.unitOnIt?.name === selectedUnit?.unit.name &&
                openModalOption(area, e)
              }
            />
          )}
          {area.unitOnIt && area.unitOnIt.reinforce > 1 && (
            <span>{area.unitOnIt.reinforce}</span>
          )}
        </div>
      ))}
      {startGame && (
        <>
          {/* Player 2 space */}
          <div className={`${styles.player} ${styles.player2}`}>
            <div></div>
            <div>
              {selectedUnit && isPlayerProperty(players[1].socketId) && (
                <span
                  className={styles.pass}
                  onClick={() => isPlayerTurn() && pass()}
                >
                  Passer ?
                </span>
              )}
            </div>
            {/* Player barrack, player can click on is own barrack to recruit an unit */}
            <div className={styles.barrack}>
              {players[1].units.map((unit) => (
                <div key={unit.id}>
                  <img
                    onClick={() =>
                      isPlayerProperty(players[1].socketId) &&
                      isPlayerTurn() &&
                      recruitUnit(unit)
                    }
                    className={styles.bagToken}
                    src={`${tokenPath}${unit.name
                      .toLowerCase()
                      .replaceAll(" ", "_")}.png`}
                    alt={unit.name}
                  />
                  <span>{unit.nb}</span>
                </div>
              ))}
            </div>
            {/* Hand, player can click on is proper hand to select an unit */}
            <div>
              {players[1].hand.map((unit, index) => (
                <div key={index}>
                  <img
                    onClick={
                      () =>
                        isPlayerProperty(players[1].socketId) &&
                        isPlayerTurn() &&
                        updateSelectedUnit(unit, index, players[1].id)
                      // setSelectedUnit({ unit, index })
                    }
                    className={`${styles.bagToken} ${
                      selectedUnit &&
                      selectedUnit.unit.id === unit.id &&
                      selectedUnit.index === index &&
                      styles.selectedUnit
                    }`}
                    src={
                      players[1].socketId === socket.id
                        ? `${tokenPath}${unit.name
                            .toLowerCase()
                            .replaceAll(" ", "_")}.png`
                        : `${tokenPath}hidden_token.png`
                    }
                    alt={
                      players[1].socketId === socket.id
                        ? unit.name
                        : "token caché"
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <img
                className={styles.bagToken}
                src="/images/tokens/bag.png"
                alt="bag"
              />
              <span>
                x{" "}
                {players[1].socketId === socket.id
                  ? players[1].bag.length
                  : "?"}
              </span>
            </div>
            {/* init, other player can click on it in their turn to stole it */}
            <div>
              {!initiative && (
                <img
                  onClick={() =>
                    !isPlayerProperty(players[1].socketId) &&
                    isPlayerTurn() &&
                    stoleInit()
                  }
                  className={styles.initToken}
                  src={players[1].initToken}
                  alt="token d'initiative"
                />
              )}
            </div>
            <div></div>
          </div>

          {/* Player 1 space */}
          <div className={`${styles.player} ${styles.player1}`}>
            <div></div>
            <div>
              {initiative && (
                <img
                  onClick={() =>
                    !isPlayerProperty(players[0].socketId) &&
                    isPlayerTurn() &&
                    stoleInit()
                  }
                  className={styles.initToken}
                  src={players[0].initToken}
                  alt="token d'initiative"
                />
              )}
            </div>
            {/* player barrack */}
            <div className={styles.barrack}>
              {players[0].units.map((unit) => (
                <div key={unit.id}>
                  <span>{unit.nb}</span>
                  <img
                    onClick={() =>
                      isPlayerProperty(players[0].socketId) &&
                      isPlayerTurn() &&
                      recruitUnit(unit)
                    }
                    className={styles.bagToken}
                    src={`${tokenPath}${unit.name
                      .toLowerCase()
                      .replaceAll(" ", "_")}.png`}
                    alt={unit.name}
                  />
                </div>
              ))}
            </div>
            {/* Hand */}
            <div>
              {players[0].hand.map((unit, index) => (
                <div key={index}>
                  <img
                    onClick={
                      () =>
                        isPlayerProperty(players[0].socketId) &&
                        isPlayerTurn() &&
                        updateSelectedUnit(unit, index, players[0].id)
                      // setSelectedUnit({ unit, index })
                    }
                    className={`${styles.bagToken} ${
                      selectedUnit &&
                      selectedUnit.unit.id === unit.id &&
                      selectedUnit.index === index &&
                      styles.selectedUnit
                    }`}
                    src={
                      players[0].socketId === socket.id
                        ? `${tokenPath}${unit.name
                            .toLowerCase()
                            .replaceAll(" ", "_")}.png`
                        : `${tokenPath}hidden_token.png`
                    }
                    alt={
                      players[0].socketId === socket.id
                        ? unit.name
                        : "token caché"
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <img
                className={styles.bagToken}
                src="/images/tokens/bag.png"
                alt="bag"
              />
              <span>
                x{" "}
                {players[0].socketId === socket.id
                  ? players[0].bag.length
                  : "?"}
              </span>
            </div>
            <div>
              {selectedUnit && isPlayerProperty(players[0].socketId) && (
                <span
                  className={styles.pass}
                  onClick={() => isPlayerTurn() && pass()}
                >
                  Passer ?
                </span>
              )}
            </div>
            <div></div>
          </div>
        </>
      )}
      {modalSelectOption.active && modalSelectOption.area && (
        <ModalSelectOption
          updateModalSelection={closeModal}
          modalSelectOption={modalSelectOption}
          updateAreaByMovementOfUnit={updateAreaByMovementOfUnit}
        />
      )}
    </div>
  );
}

export default BoardGame;
