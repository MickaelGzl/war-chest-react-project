import "./App.css";
import BoardGame from "../../components/BoardGame/BoardGame";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
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
  // Garde Royale: when attacked, the defender can sacrifice from unitOnHold
  const [gardeRoyaleChoice, setGardeRoyaleChoice] = useState<{
    attackerSocketId: string;
    areaId: number;
  } | null>(null);

  // Prevents the Fantassin extra-turn from looping: locked while the second Fantassin acts
  const fantassinExtraActiveRef = useRef(false);

  // Moine chain: tracks the drawn unit that was last put in play so we can
  // add it to unitOnHold and trigger a chain draw if it attacked/controlled.
  const moineChainRef = useRef<{
    socketId: string;
    areaId: number;
    drawnUnit: UnitInterface;
  } | null>(null);

  // Extra free turn: Fantassin second deploy, Mercenaire free action, Moine draw+play
  const [extraTurn, setExtraTurn] = useState<{
    socketId: string;
    areaId: number;
    type: "fantassin" | "mercenaire" | "moine";
    drawnUnit?: UnitInterface;
  } | null>(null);
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
      // Accept both normal end-of-round refill (hand empty) and forced mid-round refill
      const bothHandsEmpty = players[0].hand.length === 0 && players[1].hand.length === 0;
      const forcedRefill = players.some((p) => p.hand.length === 0 && p.bag.length === 0);
      if (bothHandsEmpty || forcedRefill) {
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
        removePlayedUnitFromHand(socketWhoPlayed, unitUsed, false, recrutedUnit);
        setMessages([...messages, {
          content:
            socket.id === socketWhoPlayed
              ? `Vous avez recruté un ${recrutedUnit.name} avec un ${unitUsed.name}`
              : `L'adversaire recrute un ${recrutedUnit.name}`,
          date: new Date().getTime(),
        }]);
        // Mercenaire: if a Mercenaire already on terrain, grant free action
        if (recrutedUnit.name === "Mercenaire") {
          const mercOnBoard = boardGame.find(
            (a) =>
              a.unitOnIt?.name === "Mercenaire" &&
              players.find((p) => p.socketId === socketWhoPlayed)?.units.some(
                (u) => u.id === a.unitOnIt?.id
              )
          );
          if (mercOnBoard) {
            setExtraTurn({ socketId: socketWhoPlayed, areaId: mercOnBoard.id, type: "mercenaire" });
            return; // don't changeTurn yet
          }
        }
        changeTurn(socketWhoPlayed);
      }
    );

    socket.on(
      "gameBoardUnitPosted",
      (socketWhoPlayed: string, areaId: number, unitUsed: UnitInterface) => {
        addUnitOnBoardGame(areaId, unitUsed);
        removePlayedUnitFromHand(socketWhoPlayed, unitUsed, true);
        if (socket.id !== socketWhoPlayed) {
          setMessages([...messages, {
            content: `L'adversaire place un ${unitUsed.name} sur le terrain`,
            date: new Date().getTime(),
          }]);
        }
        // Moine chain: drawn unit deployed to board → no unitOnHold needed, end chain
        if (moineChainRef.current?.socketId === socketWhoPlayed) {
          moineChainRef.current = null;
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
          setMessages([...messages, { content: `L'adversaire renforce son ${usedUnit.name}`, date: new Date().getTime() }]);
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
          setMessages([...messages, { content: `L'adversaire prend le contrôle d'une zone`, date: new Date().getTime() }]);
        }
        // Fantassin: contrôler avec un Fantassin → l'autre Fantassin allié peut agir
        if (usedUnit.name === "Fantassin" && !fantassinExtraActiveRef.current) {
          const other = boardGame.find((a) => a.id !== areaId && a.unitOnIt?.name === "Fantassin");
          if (other) {
            fantassinExtraActiveRef.current = true;
            setExtraTurn({ socketId: socketWhoPlayed, areaId: other.id, type: "fantassin" });
            return;
          }
        }
        // Moine extra-turn: the DRAWN unit just controlled a zone.
        // Same pattern as unitAttacked: add to unitOnHold, chain only if drawn Moine.
        const chainCtrl = moineChainRef.current;
        if (chainCtrl && chainCtrl.socketId === socketWhoPlayed) {
          moineChainRef.current = null;
          const actor = players.find((p) => p.socketId === socketWhoPlayed)!;
          setPlayers(
            [
              { ...actor, unitOnHold: [...actor.unitOnHold, { ...chainCtrl.drawnUnit, unvisible: true }] },
              players.find((p) => p.socketId !== socketWhoPlayed)!,
            ].sort((a, b) => a.id - b.id)
          );
          if (chainCtrl.drawnUnit.name !== "Moine") {
            changeTurn(socketWhoPlayed);
            return;
          }
          // Drawn Moine controlled → fall through to existing Moine trigger below
        }
        // Moine: after control with the Moine itself (or a drawn Moine), grants a free draw+play action
        if (usedUnit.name === "Moine") {
          const moineArea = boardGame.find((a) => a.unitOnIt?.name === "Moine" &&
            players.find((p) => p.socketId === socketWhoPlayed)?.units.some((u) => u.id === a.unitOnIt?.id)
          );
          if (moineArea) {
            setExtraTurn({ socketId: socketWhoPlayed, areaId: moineArea.id, type: "moine" });
            return;
          }
        }
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
        moveUnitOnBoardGame(areaId, previousAreaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false);
        if (socket.id !== socketWhoPlayed) {
          setMessages([...messages, { content: `L'adversaire déplace une unité`, date: new Date().getTime() }]);
        }
        // Fantassin: déplacer un Fantassin → l'autre Fantassin allié peut agir
        if (usedUnit.name === "Fantassin" && !fantassinExtraActiveRef.current) {
          const other = boardGame.find((a) => a.id !== areaId && a.id !== previousAreaId && a.unitOnIt?.name === "Fantassin");
          if (other) {
            fantassinExtraActiveRef.current = true;
            setExtraTurn({ socketId: socketWhoPlayed, areaId: other.id, type: "fantassin" });
            return;
          }
        }
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
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false, undefined, unitAttacked);
        if (socket.id !== socketWhoPlayed) {
          setMessages([...messages, { content: `L'adversaire vous attaque !`, date: new Date().getTime() }]);
        }
        // Garde Royale: if the attacked unit is a Garde Royale and the defender has a GR in unitOnHold
        if (unitAttacked.name === "Garde Royale") {
          const defender = players.find((p) => p.socketId !== socketWhoPlayed)!;
          const hasGRInReserve = defender.unitOnHold.some((u) => u.name === "Garde Royale");
          if (hasGRInReserve) {
            setGardeRoyaleChoice({ attackerSocketId: socketWhoPlayed, areaId });
            return;
          }
        }
        // Moine extra-turn: the DRAWN unit just attacked.
        // Add it to unitOnHold (it was "played" from the hand), then:
        //   • if the drawn unit was a Moine → fall through so the existing Moine trigger
        //     fires and chains another draw.
        //   • if not a Moine → end turn now (no chain).
        const chain = moineChainRef.current;
        if (chain && chain.socketId === socketWhoPlayed) {
          moineChainRef.current = null;
          const actor = players.find((p) => p.socketId === socketWhoPlayed)!;
          setPlayers(
            [
              { ...actor, unitOnHold: [...actor.unitOnHold, { ...chain.drawnUnit, unvisible: true }] },
              players.find((p) => p.socketId !== socketWhoPlayed)!,
            ].sort((a, b) => a.id - b.id)
          );
          if (chain.drawnUnit.name !== "Moine") {
            changeTurn(socketWhoPlayed);
            return;
          }
          // Drawn Moine attacked → fall through to the Moine trigger below for chain
        }
        // Moine: after attack with the Moine itself (or a drawn Moine), grants a free draw+play action
        if (usedUnit.name === "Moine") {
          const moineArea = boardGame.find(
            (a) => a.id === ownAreaId && a.unitOnIt?.name === "Moine"
          );
          if (moineArea) {
            setExtraTurn({ socketId: socketWhoPlayed, areaId: moineArea.id, type: "moine" });
            return;
          }
        }
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
        const unitAttacked = boardGame.find((a) => a.id === areaId)!.unitOnIt!;
        const unitWhoAttack = boardGame.find((a) => a.id === ownAreaId)!.unitOnIt!;
        attackUnitOnBoardGame(areaId, ownAreaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false, undefined, unitAttacked, unitWhoAttack);
        setMessages([...messages, {
          content:
            socket.id === socketWhoPlayed
              ? `Vous attaquez le Piquier ennemi et perdez un ${unitWhoAttack.name}`
              : `L'adversaire vous attaque et perd un ${unitWhoAttack.name}`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Cavalerie: move then attack (single setBoardGame to avoid stale closure)
    socket.on(
      "cavalerieActed",
      (
        socketWhoPlayed: string,
        fromAreaId: number,
        toAreaId: number | null,
        attackAreaId: number | null,
        usedUnit: UnitInterface
      ) => {
        const unitAttacked = attackAreaId !== null
          ? boardGame.find((a) => a.id === attackAreaId)?.unitOnIt ?? null
          : null;
        setBoardGame((prev) => {
          let board = prev;
          if (toAreaId !== null) {
            const unitMoved = board.find((a) => a.id === fromAreaId)!.unitOnIt!;
            board = board.map((a) => {
              if (a.id === fromAreaId) return { ...a, unitOnIt: null };
              if (a.id === toAreaId) return { ...a, unitOnIt: unitMoved };
              return a;
            });
          }
          if (attackAreaId !== null) {
            const attacked = board.find((a) => a.id === attackAreaId)!.unitOnIt!;
            board = board.map((a) => {
              if (a.id === attackAreaId) {
                return attacked.reinforce > 1
                  ? { ...a, unitOnIt: { ...attacked, reinforce: attacked.reinforce - 1 } }
                  : { ...a, unitOnIt: null };
              }
              return a;
            });
          }
          return board.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
        });
        removePlayedUnitFromHand(
          socketWhoPlayed, usedUnit, false,
          undefined, unitAttacked ?? undefined
        );
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Vous avez joué la Cavalerie`
            : `L'adversaire joue sa Cavalerie`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Soldat: attack then optionally move (single setBoardGame)
    socket.on(
      "soldatActed",
      (
        socketWhoPlayed: string,
        fromAreaId: number,
        attackAreaId: number,
        toAreaId: number | null,
        usedUnit: UnitInterface
      ) => {
        const unitAttacked = boardGame.find((a) => a.id === attackAreaId)!.unitOnIt!;
        setBoardGame((prev) => {
          let board = prev;
          const attacked = board.find((a) => a.id === attackAreaId)!.unitOnIt!;
          board = board.map((a) => {
            if (a.id === attackAreaId) {
              return attacked.reinforce > 1
                ? { ...a, unitOnIt: { ...attacked, reinforce: attacked.reinforce - 1 } }
                : { ...a, unitOnIt: null };
            }
            return a;
          });
          if (toAreaId !== null) {
            const unitMoved = board.find((a) => a.id === fromAreaId)!.unitOnIt!;
            board = board.map((a) => {
              if (a.id === fromAreaId) return { ...a, unitOnIt: null };
              if (a.id === toAreaId) return { ...a, unitOnIt: unitMoved };
              return a;
            });
          }
          return board.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
        });
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false, undefined, unitAttacked);
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Vous avez joué le Soldat`
            : `L'adversaire joue son Soldat`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Berserk: chain of moves with reinforce sacrifice (single setBoardGame)
    socket.on(
      "berserkActed",
      (
        socketWhoPlayed: string,
        moves: number[],
        sacrifices: number,
        usedUnit: UnitInterface
      ) => {
        setBoardGame((prev) => {
          let board = prev;
          for (let i = 1; i < moves.length; i++) {
            const unitMoved = board.find((a) => a.id === moves[i - 1])!.unitOnIt!;
            board = board.map((a) => {
              if (a.id === moves[i - 1]) return { ...a, unitOnIt: null };
              if (a.id === moves[i]) return { ...a, unitOnIt: unitMoved };
              return a;
            });
          }
          if (sacrifices > 0 && moves.length > 1) {
            const finalAreaId = moves[moves.length - 1];
            board = board.map((a) => {
              if (a.id === finalAreaId && a.unitOnIt) {
                return { ...a, unitOnIt: { ...a.unitOnIt, reinforce: Math.max(1, a.unitOnIt.reinforce - sacrifices) } };
              }
              return a;
            });
          }
          return board.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
        });
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false);
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Berserk : ${moves.length - 1} déplacement(s), ${sacrifices} renfort(s) sacrifié(s)`
            : `L'adversaire joue son Berserk (${moves.length - 1} déplacements)`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Lancier: charge (attack + move to intermediate cell)
    socket.on(
      "lancierActed",
      (
        socketWhoPlayed: string,
        fromAreaId: number,
        moveToAreaId: number | null,
        attackAreaId: number,
        usedUnit: UnitInterface
      ) => {
        const unitAttacked = boardGame.find((a) => a.id === attackAreaId)?.unitOnIt ?? null;
        setBoardGame((prev) => {
          let board = prev;
          // Attack the target
          const attacked = board.find((a) => a.id === attackAreaId)?.unitOnIt;
          if (attacked) {
            board = board.map((a) => {
              if (a.id === attackAreaId) {
                return attacked.reinforce > 1
                  ? { ...a, unitOnIt: { ...attacked, reinforce: attacked.reinforce - 1 } }
                  : { ...a, unitOnIt: null };
              }
              return a;
            });
          }
          // Move Lancier to intermediate position (cell just in front of enemy)
          if (moveToAreaId !== null) {
            const lancierUnit = board.find((a) => a.id === fromAreaId)?.unitOnIt;
            if (lancierUnit) {
              board = board.map((a) => {
                if (a.id === fromAreaId) return { ...a, unitOnIt: null };
                if (a.id === moveToAreaId) return { ...a, unitOnIt: lancierUnit };
                return a;
              });
            }
          }
          return board.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
        });
        if (unitAttacked) {
          removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false, undefined, unitAttacked);
        }
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Vous avez chargé avec le Lancier`
            : `L'adversaire charge avec son Lancier`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Porte-Étendard: move an ally
    socket.on(
      "portEtendardActed",
      (
        socketWhoPlayed: string,
        _bannerAreaId: number,
        allyFromAreaId: number,
        allyToAreaId: number,
        usedUnit: UnitInterface
      ) => {
        moveUnitOnBoardGame(allyToAreaId, allyFromAreaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false);
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Vous avez déplacé un allié avec le Porte-Étendard`
            : `L'adversaire déplace un allié avec son Porte-Étendard`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Capitaine: ally attacks
    socket.on(
      "capitaineActed",
      (
        socketWhoPlayed: string,
        _captainAreaId: number,
        _allyAreaId: number,
        attackAreaId: number,
        usedUnit: UnitInterface
      ) => {
        const unitAttacked = boardGame.find((a) => a.id === attackAreaId)!.unitOnIt!;
        attackUnitOnBoardGame(attackAreaId);
        removePlayedUnitFromHand(socketWhoPlayed, usedUnit, false, undefined, unitAttacked);
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Vous avez fait attaquer un allié avec le Capitaine`
            : `L'adversaire fait attaquer un allié avec son Capitaine`,
          date: new Date().getTime(),
        }]);
        changeTurn(socketWhoPlayed);
      }
    );

    // Fantassin: second fantassin activated — no immediate board change needed
    socket.on("fantassinSecondActivated", () => {});

    // Mercenaire: free turn granted — no immediate board change needed
    socket.on("mercenaireFreeTurnGranted", () => {});

    // Garde Royale: defender sacrifices from unitOnHold instead of losing board reinforce
    socket.on(
      "gardeRoyaleSacrificed",
      (
        socketWhoPlayed: string, // the DEFENDER who chose to sacrifice
        _areaId: number,
        _usedUnit: UnitInterface
      ) => {
        // Remove specifically a Garde Royale from defender's unitOnHold
        const defender = players.find((p) => p.socketId === socketWhoPlayed)!;
        const grIdx = defender.unitOnHold.findIndex((u) => u.name === "Garde Royale");
        if (grIdx !== -1) {
          const sacrificed = defender.unitOnHold[grIdx];
          const newUnitOnHold = [...defender.unitOnHold];
          newUnitOnHold.splice(grIdx, 1);
          const updatedDefender = {
            ...defender,
            unitOnHold: newUnitOnHold,
            graveyard: [...defender.graveyard, sacrificed],
          };
          const attacker = players.find((p) => p.socketId !== socketWhoPlayed)!;
          setPlayers([attacker, updatedDefender].sort((a, b) => a.id - b.id));
        }
        setGardeRoyaleChoice(null);
        changeTurn(players.find((p) => p.socketId !== socketWhoPlayed)!.socketId);
      }
    );

    // Moine: both clients learn which unit was drawn and update the bag
    socket.on(
      "moineUnitDrawn",
      (
        socketWhoPlayed: string,
        drawnUnit: UnitInterface,
        moineAreaId: number
      ) => {
        // Remove the drawn unit from the player's bag (or unitOnHold if bag is empty)
        const player = players.find((p) => p.socketId === socketWhoPlayed)!;
        const bagIdx = player.bag.findIndex((u) => u.id === drawnUnit.id);
        let newBag = [...player.bag];
        let newHold = [...player.unitOnHold];
        if (bagIdx !== -1) {
          newBag.splice(bagIdx, 1);
        } else {
          // Bag was empty, drawn from unitOnHold pool
          const holdIdx = player.unitOnHold.findIndex((u) => u.id === drawnUnit.id);
          if (holdIdx !== -1) newHold.splice(holdIdx, 1);
        }
        const updatedPlayer = { ...player, bag: newBag, unitOnHold: newHold };
        const other = players.find((p) => p.socketId !== socketWhoPlayed)!;
        setPlayers([updatedPlayer, other].sort((a, b) => a.id - b.id));
        setMessages([...messages, {
          content: socket.id === socketWhoPlayed
            ? `Moine : vous piochez un ${drawnUnit.name}`
            : `Le Moine adverse pioche une pièce`,
          date: new Date().getTime(),
        }]);
        // Track the drawn unit so we can add it to unitOnHold after use
        moineChainRef.current = { socketId: socketWhoPlayed, areaId: moineAreaId, drawnUnit };
        // Grant the extra turn with the drawn unit info
        setExtraTurn({ socketId: socketWhoPlayed, areaId: moineAreaId, type: "moine", drawnUnit });
      }
    );

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
      socket.off("cavalerieActed");
      socket.off("soldatActed");
      socket.off("berserkActed");
      socket.off("lancierActed");
      socket.off("portEtendardActed");
      socket.off("capitaineActed");
      socket.off("fantassinSecondActivated");
      socket.off("mercenaireFreeTurnGranted");
      socket.off("gardeRoyaleSacrificed");
      socket.off("moineUnitDrawn");
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

  // Auto-pass when current player has no hand AND no bag tokens
  useEffect(() => {
    if (!startGame || !socketTurn) return;
    const currentPlayer = players.find((p) => p.socketId === socketTurn);
    if (!currentPlayer) return;
    if (currentPlayer.hand.length > 0) return; // still has pieces to play
    // Only the affected player's client acts
    if (socket.id !== currentPlayer.socketId) return;

    const otherPlayer = players.find((p) => p.socketId !== socketTurn)!;

    if (otherPlayer.hand.length === 0) {
      // Both hands empty simultaneously
      if (currentPlayer.bag.length === 0 && otherPlayer.bag.length === 0) {
        // Fully depleted mid-round → force a hand refill (player 0 emits)
        if (socket.id === players[0].socketId) {
          socket.emit("makePlayersHand", players);
        }
      }
      // Normal end-of-round: the nbTurn % 6 useEffect handles the refill — do nothing
      return;
    }

    // Only this player has no hand pieces left → auto-pass silently
    setMessages((prev) => [
      ...prev,
      { content: "Vous n'avez plus de jetons — passage automatique", date: new Date().getTime() },
    ]);
    socket.emit("pass", { id: 0, name: "auto-pass", nb: 0, cap: "" });
  }, [socketTurn, players]);

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
    fantassinExtraActiveRef.current = false;
    setExtraTurn(null);
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
    // Guard: unit may not be in hand if it's an extra-turn action (Fantassin, Mercenaire)
    const handIdx = playerWhoPlayed.hand.findIndex((unit) => unit.id === unitUsed.id);
    if (handIdx !== -1) {
      playerWhoPlayed.hand.splice(handIdx, 1);
      if (!postedOnGround) {
        playerWhoPlayed.unitOnHold.push({ ...unitUsed, unvisible: true });
      }
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
              extraTurn={extraTurn}
              clearExtraTurn={() => setExtraTurn(null)}
              gardeRoyaleChoice={gardeRoyaleChoice}
              onGardeRoyaleSacrifice={(areaId) => {
                socket.emit("gardeRoyaleSacrifice", areaId, {} as UnitInterface);
              }}
              onGardeRoyaleDecline={(areaId) => {
                // Defender declines — normal attack applies, turn advances
                attackUnitOnBoardGame(areaId);
                setGardeRoyaleChoice(null);
                if (gardeRoyaleChoice) {
                  changeTurn(gardeRoyaleChoice.attackerSocketId);
                }
              }}
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
