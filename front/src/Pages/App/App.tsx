import "./App.css";
import BoardGame from "../../components/BoardGame/BoardGame";
import { Suspense, lazy, useEffect, useState } from "react";
import GameSelection from "../../components/GameSelection/GameSelection";
import {
  PlayerInterface,
  UnitInterface,
  MessageInterface,
  AreaInterface,
} from "../../@types/interfaces";
import Loader from "../../components/Loader/Loader";
import { socket } from "../../config/socketConfig";
import GameConfig from "../GameConfig/GameConfig";
import Chat from "../../components/Chat/Chat";
import { createBoard } from "../../utils/createBoard";
import { units } from "../../datas/units";

const GameDetails = lazy(
  () => import("../../components/GameDetails/GameDetails")
);

function App() {
  const [username, setUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const [socketsConnected, setSocketsConnected] = useState(false);
  const [unitsSelection, setUnitSelection] = useState<UnitInterface[]>([]); //units displayed in GameSelection
  const [inGameSelection, setInGameSelection] = useState(true); //selection isn't finished
  const [socketTurn, setSocketTurn] = useState(""); //strangely, have no value here but in children props it has a value...

  const [startGame, setStartGame] = useState(false); //selection and config is finished
  const [initiative, setInitiative] = useState(false); //true = p1 turn
  const [initAlreadyStole, setInitAlreadyStole] = useState(false);
  const [nbTurn, setNbTurn] = useState(0);
  // const [playerReTurn, setPlayerReTurn] = useState<[boolean, number | null]>([
  //   false,
  //   null,
  // ]);  //comment for now car ça me casse les couilles

  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [boardGame, setBoardGame] = useState<AreaInterface[]>([]);

  const [players, setPlayers] = useState<PlayerInterface[]>([
    {
      id: 1,
      socketId: "",
      initToken: "/images/tokens/p1_init_token.png",
      units: [],
      bag: [],
      hand: [],
      unitOnHold: [],
      graveyard: [],
    },
    {
      id: 2,
      socketId: "",
      initToken: "/images/tokens/p2_init_token.png",
      units: [],
      bag: [],
      hand: [],
      unitOnHold: [],
      graveyard: [],
    },
  ]);

  useEffect(() => {
    socket.on(
      "unitSelected",
      (selectedUnit: UnitInterface, unitsLeft: UnitInterface[], socketId) => {
        // console.log("receive unitSelected: ", players);
        updatePlayerUnits(socketId, selectedUnit);
        setUnitSelection(unitsLeft);
      }
    );

    socket.on(
      "launchGame",
      (newPlayers: PlayerInterface[], isP1Init: boolean) => {
        // console.log(
        //   "the game can start, here the info of players with barrack and bag"
        // );
        // console.log(newPlayers);
        setSocketTurn(isP1Init ? players[0].socketId : players[1].socketId);
        setInitiative(isP1Init); //marche pas, n'actualise pas
        setPlayers(newPlayers);
        setBoardGame(createBoard());
        setTimeout(() => setStartGame(true), 1500);
      }
    );

    socket.on("playerHandDone", (newPlayers: PlayerInterface[]) => {
      if (players[0].hand.length === 0) {
        // console.log("make hand: ", newPlayers);
        setPlayers(newPlayers);
        setSocketTurn(initiative ? players[0].socketId : players[1].socketId);
        setInitAlreadyStole(false);
      }
    });

    socket.on("newMessage", (newMessage: MessageInterface) => {
      // console.log("receiveMessage: ", newMessage.date);
      // console.log([...messages, newMessage]);
      setMessages((previousValue) => [...previousValue, newMessage]);
    });

    socket.on("passed", (socketWhoPlayed: string, unitUsed: UnitInterface) => {
      if (socket.id !== socketWhoPlayed) {
        setMessages([
          ...messages,
          {
            content: "L'adversaire passe son tour",
            date: new Date().getTime(),
          },
        ]);
      }
      removePlayedUnitFromHand(socketWhoPlayed, unitUsed, false);
      changeTurn(socketWhoPlayed);
    });

    socket.on(
      "initStole",
      (socketWhoPlayed: string, unitUsed: UnitInterface) => {
        updateInitiative(socketWhoPlayed, unitUsed);
      }
    );

    socket.on(
      "unitRecruted",
      (
        socketWhoPlayed: string,
        unitUsed: UnitInterface,
        recrutedUnit: UnitInterface
      ) => {
        removePlayedUnitFromHand(
          socketWhoPlayed,
          unitUsed,
          false,
          recrutedUnit
        );
        setMessages([
          ...messages,
          {
            content:
              socket.id === socketWhoPlayed
                ? `Vous avez recruté un ${recrutedUnit.name} avec un ${unitUsed.name}`
                : `L'adversaire recrute un ${recrutedUnit.name}`,
            date: new Date().getTime(),
          },
        ]);
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "gameBoardUnitPosted",
      (socketWhoPlayed: string, areaId: number, unitUsed: UnitInterface) => {
        console.log("post this unit: ", unitUsed);
        addUnitOnBoardGame(areaId, unitUsed);
        removePlayedUnitFromHand(socketWhoPlayed, unitUsed, true);
        if (socket.id !== socketWhoPlayed) {
          setMessages([
            ...messages,
            {
              content: `L'adversaire place un ${unitUsed.name} sur le terrain`,
              date: new Date().getTime(),
            },
          ]);
        }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "unitReinforced",
      (socketWhoPlayed: string, areaId: number, usedUnit: UnitInterface) => {
        reinforceUnitOnBoardGame(areaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, true);
        if (socket.id !== socketWhoPlayed) {
          setMessages([
            ...messages,
            {
              content: `L'adversaire renforce son ${usedUnit.name}`,
              date: new Date().getTime(),
            },
          ]);
        }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "areaControlled",
      (socketWhoPlayed: string, areaId: number, usedUnit: UnitInterface) => {
        controlAreaOnBoardGame(areaId, socketWhoPlayed);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false);
        if (socket.id !== socketWhoPlayed) {
          setMessages([
            ...messages,
            {
              content: `L'adversaire prend le contrôle d'une zone`,
              date: new Date().getTime(),
            },
          ]);
        }
        // if (unitHaveAnotherTurn(socketWhoPlayed, areaId, usedUnit.name)) {
        //   setPlayerReTurn([true, areaId]);
        //   return;
        // }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "gameBoardUnitMoved",
      (
        socketWhoPlayed: string,
        areaId: number,
        usedUnit: UnitInterface,
        previousAreaId: number
      ) => {
        console.log("move an unit: ", usedUnit);
        moveUnitOnBoardGame(areaId, previousAreaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false);
        if (socket.id !== socketWhoPlayed) {
          setMessages([
            ...messages,
            {
              content: `L'adversaire déplace une unité`,
              date: new Date().getTime(),
            },
          ]);
        }
        // if (
        //   unitHaveAnotherTurn(socketWhoPlayed, previousAreaId, usedUnit.name)
        // ) {
        //   setPlayerReTurn([true, previousAreaId]);
        //   return;
        // }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "unitAttacked",
      (
        socketWhoPlayed: string,
        areaId: number,
        usedUnit: UnitInterface,
        ownAreaId: number
      ) => {
        const unitAttacked = boardGame.find((a) => a.id === areaId)!.unitOnIt!;
        attackUnitOnBoardGame(areaId);
        removePlayedUnitFromHand(
          socketWhoPlayed,
          usedUnit,
          false,
          undefined,
          unitAttacked
        );
        if (socket.id !== socketWhoPlayed) {
          setMessages([
            ...messages,
            {
              content: `L'adversaire vous attaque !`,
              date: new Date().getTime(),
            },
          ]);
        }
        // if (unitHaveAnotherTurn(socketWhoPlayed, ownAreaId, usedUnit.name)) {
        //   setPlayerReTurn([true, ownAreaId]);
        //   return;
        // }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "sacrificeForUnitAttack",
      (
        socketWhoPlayed: string,
        areaId: number,
        usedUnit: UnitInterface,
        ownAreaId: number
      ) => {
        // console.log(areaId);
        // console.log(ownAreaId);
        console.log(boardGame.find((a) => a.id === areaId));
        const unitAttacked = boardGame.find((a) => a.id === areaId)!.unitOnIt!;
        const unitWhoAttack = boardGame.find((a) => a.id === ownAreaId)!
          .unitOnIt!;
        //suppress 1 of ennemi and 1 of ally
        attackUnitOnBoardGame(areaId, ownAreaId);
        //add to ennemi graveyard, ally unitOnHold but also ally graveyard
        removePlayedUnitFromHand(
          socketWhoPlayed,
          usedUnit,
          false,
          undefined,
          unitAttacked,
          unitWhoAttack
        );
        setMessages([
          ...messages,
          {
            content:
              socket.id === socketWhoPlayed
                ? `Vous attaquez le Piquier ennemi et perdez un ${unitWhoAttack.name}`
                : `L'adversaire vous attaque et perd un ${unitWhoAttack.name}`,
            date: new Date().getTime(),
          },
        ]);

        // if (unitHaveAnotherTurn(socketWhoPlayed, ownAreaId, usedUnit.name)) {
        //   setPlayerReTurn(true);
        //   return;
        // }
        changeTurn(socketWhoPlayed);
      }
    );
    // console.log("le boardgame: ", boardGame);
    return () => {
      socket.off("unitSelected");
      socket.off("launchGame");
      socket.off("playerHandDone");
      socket.off("newMessage");
      socket.off("passed");
      socket.off("initStole");
      socket.off("unitRecruted");
      socket.off("gameBoardUnitPosted");
      socket.off("unitReinforced");
      socket.off("areaControlled");
      socket.off("gameBoardUnitMoved");
      socket.off("unitAttacked");
      socket.off("sacrificeForUnitAttack");
    };
  }, [players, boardGame]);

  useEffect(() => {
    if (unitsSelection.length % 2 !== 0) {
      // console.log("player turn change");
      const playerTurn = players.find(
        (player) => player.socketId !== socketTurn
      )!;
      setSocketTurn(playerTurn.socketId);
    } else if (unitsSelection.length === 0 && players[0].units.length !== 0) {
      setInGameSelection(false);
    }
  }, [unitsSelection]);

  //Game selection is finish and each players have their units
  //ask socket to make bag of each players and give initiative
  useEffect(() => {
    if (!inGameSelection) {
      //tricky, but only one socket need to emit the event
      if (socket.id === players[0].socketId) {
        socket.emit("gameSelectionEnded", players);
      }
    }
  }, [inGameSelection]);

  useEffect(() => {
    //on launchGame will set startGame to true, each 6 turn, remake players hands
    //make players hand with players.bags
    if (startGame && nbTurn % 6 === 0) {
      if (socket.id === players[0].socketId) {
        socket.emit("makePlayersHand", players);
      }
    }
  }, [nbTurn, startGame]);

  /**
   * Update the player username and save it to localStorage for next uses
   * @param name the name wrote by the user
   */
  const updateUsername = (name: string) => {
    localStorage.setItem("username", name);
    setUsername(name);
  };

  /**
   * Update player's units by adding in it the one selected in GameSelection.
   * @param selectedUnit the unit selected in GameSelection
   * @returns earlier if unit already added (useEffect launch 2 times in development)
   */
  const updatePlayerUnits = (socketId: string, selectedUnit: UnitInterface) => {
    const playerToUpdate = players.find(
      (player) => player.socketId === socketId
    )!;
    if (
      playerToUpdate.units.length !== 0 &&
      playerToUpdate.units.find(
        (alreadyHaveUnit) => alreadyHaveUnit.id === selectedUnit.id
      )
    ) {
      return;
    }

    playerToUpdate.units.push(selectedUnit);
    setPlayers(
      [
        ...players.filter((player) => player.socketId !== socketId),
        playerToUpdate,
      ].sort((a, b) => a.id - b.id)
    );
    setSocketTurn(socketId);
  };

  const updateSelectionUnits = (array: UnitInterface[]) => {
    setUnitSelection(array);
  };

  const updateSocketConnected = (userjoin: string) => {
    setSocketsConnected(true);
    console.log(`${userjoin} à rejoint la salle`);
  };

  const updateMessages = (newMessage: MessageInterface) => {
    setMessages([...messages, newMessage]);
  };

  /**
   * GameConfig is finished. Give each players their socket.id and go to GameSelection
   * @param socketIds
   */
  const updatePlayersSocketId = (socketIds: string[]) => {
    setSocketTurn(socketIds[0]);
    const player1 = players.find((player) => player.id === 1)!;
    player1.socketId = socketIds[0];
    const player2 = players.find((player) => player.id === 2)!;
    player2.socketId = socketIds[1];
    setPlayers([player1, player2]);
    // console.log(`Vous êtes joueur ${socket.id === socketIds[0] ? "1" : "2"}`);
  };

  //FUNCTION FOR GAME
  /**
   * When a player stole init. send message if init have already been stolen for this round
   * else update initiative
   * think this work. need to socket it now
   * send info player stole init in else
   */
  const changeTurn = (previousTurnSocket: string) => {
    // if (playerReTurn[0]) {
    //   setPlayerReTurn([false, null]);
    // }
    setNbTurn(nbTurn + 1);
    setSocketTurn(
      players.find((player) => player.socketId !== previousTurnSocket)!.socketId
    );
  };

  /**
   * remove the unit player for the turn from player hand, and add it to player unitOnHold.
   * If recrut a unit with, remove one from barrack and add it to unitOnHold too
   * @param socketWhoPlayed the socketId of the player who played the turn
   * @param unitUsed the player hand's unit player for the turn
   * @param unitRecruted the recruted unit if player use if unit to recruit another
   */
  const removePlayedUnitFromHand = (
    socketWhoPlayed: string,
    unitUsed: UnitInterface,
    postedOnGround: boolean,
    unitRecruted: UnitInterface | undefined = undefined,
    unitAttacked: UnitInterface | undefined = undefined,
    unitLostWhileAttacking: UnitInterface | undefined = undefined
  ) => {
    const playerWhoPlayed = players.find(
      (player) => player.socketId === socketWhoPlayed
    )!;
    // console.log("player who played: ", playerWhoPlayed);
    // console.log(unitUsed);
    playerWhoPlayed.hand.splice(
      playerWhoPlayed.hand.findIndex((unit) => unit.id === unitUsed.id),
      1
    );
    if (!postedOnGround) {
      playerWhoPlayed.unitOnHold.push({ ...unitUsed, unvisible: true });
    }

    if (unitRecruted) {
      const recrutedUnit = playerWhoPlayed.units.find(
        (unit) => unit.id === unitRecruted.id
      )!;
      recrutedUnit.nb -= 1;
      playerWhoPlayed.unitOnHold.push({ ...recrutedUnit, nb: 1 });
    }

    const otherPlayer = players.filter(
      (player) => player.socketId !== socketWhoPlayed
    )[0];

    if (unitAttacked) {
      otherPlayer.graveyard = [...otherPlayer.graveyard, unitAttacked];
    }

    if (unitLostWhileAttacking) {
      playerWhoPlayed.graveyard = [
        ...playerWhoPlayed.graveyard,
        unitLostWhileAttacking,
      ];
    }

    // console.log("players value: ", players);
    setPlayers([otherPlayer, playerWhoPlayed].sort((a, b) => a.id - b.id));
  };

  const updateInitiative = (
    socketWhoPlayed: string,
    unitUsed: UnitInterface
  ) => {
    // console.log("socketTurn: ", socketTurn); //never have value here, so use socket.id send by server
    // console.log("value that socketTurn have not: ", socketWhoPlayed);
    // console.log(unitUsed);
    removePlayedUnitFromHand(socketWhoPlayed, unitUsed, false);
    setInitiative(!initiative);
    setInitAlreadyStole(true);
    setMessages([
      ...messages,
      {
        content:
          socket.id === socketWhoPlayed
            ? "Vous avez volé l'initiative"
            : "L'initiative vous à été dérobée",
        date: new Date().getTime(),
      },
    ]);
    changeTurn(socketWhoPlayed);
  };

  /**
   * add to the area finded by id the unit
   * @param areaId the area where the new unit was posted
   * @param unitUsed the unit posted
   */
  const addUnitOnBoardGame = (areaId: number, unitUsed: UnitInterface) => {
    setBoardGame(
      boardGame.map((a) => {
        return a.id === areaId
          ? {
              ...a,
              unitOnIt: {
                ...unitUsed,
                reinforce: 1,
              },
              canPostOn: false,
              canAttack: false,
              // move: true,
            }
          : { ...a, canPostOn: false, canAttack: false };
      })
    );
  };

  const reinforceUnitOnBoardGame = (areaId: number) => {
    setBoardGame(
      boardGame.map((a) => {
        if (a.id === areaId) {
          a.unitOnIt!.reinforce = a.unitOnIt!.reinforce + 1;
        }
        return { ...a, canPostOn: false, canAttack: false };
      })
    );
  };

  const controlAreaOnBoardGame = (areaId: number, socketWhoPlayed: string) => {
    setBoardGame(
      boardGame.map((a) => {
        if (a.id === areaId) {
          a.controlledBy = players.find(
            (p) => p.socketId === socketWhoPlayed
          )!.id;
        }
        return { ...a, canPostOn: false, canAttack: false };
      })
    );
  };

  const moveUnitOnBoardGame = (areaId: number, previousAreaId: number) => {
    const unitPosted = {
      ...boardGame.find((a) => a.id === previousAreaId)!.unitOnIt!,
    };
    setBoardGame(
      boardGame.map((a) => {
        if (a.id === areaId) {
          a.unitOnIt = unitPosted;
        } else if (a.id === previousAreaId) {
          a.unitOnIt = null;
        }
        return { ...a, canPostOn: false, canAttack: false };
      })
    );
  };

  const attackUnitOnBoardGame = (areaId: number, ownAreaId: number = 0) => {
    const areaAttacked = boardGame.find((a) => a.id === areaId)!;
    if (ownAreaId !== 0) {
      setBoardGame(
        boardGame.map((a) => {
          if (a.id === areaId || a.id === ownAreaId) {
            a.unitOnIt =
              a.unitOnIt!.reinforce > 1
                ? { ...a.unitOnIt!, reinforce: a.unitOnIt!.reinforce - 1 }
                : null;
          }
          return { ...a, canPostOn: false, canAttack: false };
        })
      );
    } else if (areaAttacked.unitOnIt!.reinforce > 1) {
      setBoardGame(
        boardGame.map((a) => {
          if (a.id === areaId) {
            a.unitOnIt!.reinforce = a.unitOnIt!.reinforce - 1;
          }
          return { ...a, canPostOn: false, canAttack: false };
        })
      );
    } else {
      setBoardGame(
        boardGame.map((a) => {
          if (a.id === areaId) {
            a.unitOnIt = null;
          }
          return { ...a, canPostOn: false, canAttack: false };
        })
      );
    }
  };

  /**
   * verify if unit can have another turn (Berserk with reinforce > 1 or another Fantassin on boardgame)
   * @param socketId player.socketId
   * @param areaPlayerId area played for this turn (we not have it everyTime I guess)
   * @param name the unit played name
   */

  // const unitHaveAnotherTurn = (
  //   socketId: string,
  //   areaPlayerId: number,
  //   name: string
  // ): boolean => {
  //   console.log("App 641: verify if unit can have another turn");
  //   if (name !== "Berserk" && name !== "Fantassin") {
  //     console.log("App 643: no Fantassin or Berserk");
  //     return false;
  //   }
  //   switch (name) {
  //     case "Berserk":
  //       return false;
  //     case "Fantassin":
  //       console.log("App 650 playerReTurn: ", playerReTurn);
  //       if (playerReTurn[0]) {
  //         return false;
  //       }
  //       const isAnotherFantassin = boardGame
  //         .filter((b) => b.id !== areaPlayerId)
  //         .find((b) => b.unitOnIt?.name === "Fantassin");
  //       console.log("App 655 isAnotherFant: ", isAnotherFantassin);
  //       if (isAnotherFantassin) {
  //         return true;
  //       }
  //       console.log("App 661 why we are here");
  //       return false;
  //     default:
  //       console.log("What the fuck ?");
  //       return false;
  //   }
  // };

  return (
    <>
      {socketsConnected ? (
        <>
          <div className="App">
            <BoardGame
              players={players}
              startGame={startGame}
              boardGame={boardGame}
              initiative={initiative}
              initAlreadyStole={initAlreadyStole}
              socket={socket}
              socketTurn={socketTurn}
              updateMessages={updateMessages}
              // playerReTurn={playerReTurn}
            />
            {!inGameSelection &&
              (!startGame ? (
                <Loader />
              ) : (
                <Suspense fallback={<Loader />}>
                  <GameDetails
                    players={players}
                    socketTurn={socketTurn}
                    socket={socket}
                  />
                </Suspense>
              ))}
          </div>
          {inGameSelection && (
            <GameSelection
              unitsSelection={unitsSelection}
              setInGameSelection={setInGameSelection}
              socket={socket}
              players={players}
              socketTurn={socketTurn}
            />
          )}
          <Chat socket={socket} messages={messages} />
        </>
      ) : (
        <GameConfig
          username={username}
          updateUsername={updateUsername}
          socket={socket}
          updateSocketConnected={updateSocketConnected}
          updateSelectionUnits={updateSelectionUnits}
          updatePlayersSocketId={updatePlayersSocketId}
        />
      )}
    </>
  );
}

export default App;
