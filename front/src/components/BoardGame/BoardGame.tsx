import { useEffect, useState } from "react";
import { BoardGamePropsType, MovementTypes, PendingAction } from "../../@types/types";
import { tokenPath } from "../../utils/paths";
import styles from "./boardGame.module.css";
import {
  AreaInterface,
  UnitInterface,
} from "../../@types/interfaces";
import ModalSelectOption from "../ModalSelectOption/ModalSelectOption";
import { unitIsNotOneOfPlayer } from "../../utils/verifyUnitAppartenance";
import { createMovement } from "../../utils/createMovement";
import { isWinner } from "../../utils/isWinner";

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
    extraTurn,
    clearExtraTurn,
    gardeRoyaleChoice,
    onGardeRoyaleSacrifice,
    onGardeRoyaleDecline,
  } = props;

  const [winner, setWinner] = useState(0);

  const [modalSelectOption, setModalSelectOption] = useState<{
    active: boolean;
    area?: AreaInterface;
    playerId?: number;
    disableReinforce?: boolean;
  }>({ active: false });
  const [areas, setAreas] = useState<AreaInterface[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<
    { unit: UnitInterface; index: number } | undefined
  >();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    const w = isWinner(boardGame);
    if (w !== 0) {
      setWinner(w);
    }
    setAreas(boardGame);
  }, [boardGame]);

  // Auto-activate extra turn (Fantassin second deploy, Mercenaire free action, Moine draw+play)
  useEffect(() => {
    if (!extraTurn || socket.id !== extraTurn.socketId) return;

    if (extraTurn.type === "moine") {
      const player = players.find((p) => p.socketId === extraTurn.socketId);
      if (!player) return;

      let drawnUnit = extraTurn.drawnUnit;

      if (!drawnUnit) {
        // Active client draws and broadcasts — only emit once (when drawnUnit not yet known)
        if (socket.id !== extraTurn.socketId) return;
        // Bag empty: try unitOnHold, otherwise end turn
        const pool = player.bag.length > 0 ? player.bag : player.unitOnHold;
        if (pool.length === 0) {
          // Nothing to draw — end turn gracefully
          socket.emit("pass", { id: 0, name: "moine-skip", nb: 0, cap: "" });
          clearExtraTurn();
          return;
        }
        const drawnIdx = Math.floor(Math.random() * pool.length);
        drawnUnit = pool[drawnIdx];
        setPendingAction(null);
        setSelectedUnit(undefined);
        socket.emit("moineDrawBroadcast", drawnUnit, extraTurn.areaId);
        return;
      }

      // drawnUnit is now known — set up the extra turn UI
      setSelectedUnit({ unit: drawnUnit, index: -1 });
      const playerId = player.id;
      // Compute both deploy zones and attack zones for the drawn unit
      const alreadyOnBoard = boardGame.find((a) => a.unitOnIt?.name === drawnUnit!.name);
      const moineArea = boardGame.find((a) => a.id === extraTurn.areaId);
      let newAreas = boardGame.map((a) => ({
        ...a,
        canPostOn: !alreadyOnBoard && a.controlledBy === playerId && !a.unitOnIt,
        canAttack: false,
      }));
      // If the unit is already on board, show its attack/move zones from the moine's position
      if (alreadyOnBoard && moineArea) {
        newAreas = createMovement(drawnUnit!.name, moineArea, newAreas, players, socketTurn);
        // Don't show canPostOn (unit already deployed)
        newAreas = newAreas.map((a) => ({ ...a, canPostOn: false }));
      }
      setPendingAction({ type: "moine-extra", moineAreaId: extraTurn.areaId, unit: drawnUnit });
      setAreas(newAreas);
      return;
    }

    // Fantassin / Mercenaire: auto-open modal for the on-board unit
    const area = boardGame.find((a) => a.id === extraTurn.areaId);
    if (!area?.unitOnIt) return;
    setSelectedUnit({ unit: area.unitOnIt, index: -1 });
    setModalSelectOption({
      active: true,
      area,
      playerId: players.find((p) => p.socketId === extraTurn.socketId)?.id,
      // Mercenaire and Fantassin extra turns: reinforcing is not allowed
      disableReinforce: extraTurn.type === "mercenaire" || extraTurn.type === "fantassin",
    });
  }, [extraTurn]);

  const closeModal = () => {
    setModalSelectOption({ active: false });
  };

  function isPlayerTurn(): boolean {
    return socket.id === socketTurn;
  }

  function isPlayerProperty(playerSocketId: string): boolean {
    return socket.id === playerSocketId;
  }

  const updateSelectedUnit = (
    unit: UnitInterface,
    index: number,
    playerId: number
  ) => {
    // Sceau Royal: never show deployment zones; show GR movement zones if GR is on board
    if (unit.name === "Sceau Royal") {
      const cleared = areas.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
      const gardeRoyaleArea = cleared.find(
        (a) => a.unitOnIt?.name === "Garde Royale" && !unitIsNotOneOfPlayer(a.unitOnIt!, players, socketTurn)
      );
      if (gardeRoyaleArea) {
        const withZones = cleared.map((a) => {
          const inRange =
            gardeRoyaleArea.areasAround.includes(a.key) ||
            gardeRoyaleArea.areasAt2Cases.includes(a.key);
          if (inRange && a.controlledBy === playerId && !a.unitOnIt) {
            a.canPostOn = true;
          }
          return a;
        });
        setPendingAction({ type: "sceau-royal", gardeRoyaleAreaId: gardeRoyaleArea.id, unit });
        setAreas(withZones);
      } else {
        // No GR on board: no highlights, but can still pass / recruit / steal init
        setPendingAction(null);
        setAreas(cleared);
      }
      setSelectedUnit({ unit, index });
      return;
    }

    // Always clear any pending action when a new unit is selected from hand
    setPendingAction(null);

    const areaWithSameUnit = areas.find((a) => a.unitOnIt?.name === unit.name);
    // Always build a fresh immutable copy with highlights cleared
    let newAreas = areas.map((area) => ({ ...area, canPostOn: false, canAttack: false }));

    const canDeploy =
      !areaWithSameUnit ||
      (unit.name === "Fantassin" &&
        newAreas.filter((a) => a.unitOnIt?.name === "Fantassin").length === 1);

    if (canDeploy) {
      newAreas = newAreas.map((area) => {
        if (area.controlledBy === playerId && !area.unitOnIt) {
          return { ...area, canPostOn: true };
        }
        return area;
      });
      if (unit.name === "Éclaireur") {
        const playerWhoPlay = players.find((player) => player.id === playerId)!;
        // Collect keys adjacent to any allied unit on board
        const adjacentKeys = new Set<string>();
        newAreas.forEach((area) => {
          if (area.unitOnIt && playerWhoPlay.units.find((u) => u.id === area.unitOnIt?.id)) {
            area.areasAround.forEach((k) => adjacentKeys.add(k));
          }
        });
        // Mark those empty zones as deployable (in addition to controlled zones)
        newAreas = newAreas.map((area) =>
          adjacentKeys.has(area.key) && !area.unitOnIt
            ? { ...area, canPostOn: true }
            : area
        );
      }
    }

    // Always update areas so stale highlights from a previous selection are cleared
    setAreas(newAreas.sort((a, b) => a.id - b.id));
    setSelectedUnit({ unit, index });
  };

  function openModalOption(
    area: AreaInterface,
    e?: React.MouseEvent<HTMLImageElement, MouseEvent>
  ) {
    if (e) {
      e.stopPropagation();
    }
    // Cancel any in-progress multi-step action so re-opening the modal starts fresh
    if (pendingAction) {
      setPendingAction(null);
      setAreas(clearHighlights(areas));
    }
    setModalSelectOption({
      active: true,
      area,
      playerId: players.find((p) => p.socketId === socketTurn)!.id,
    });
  }

  function clearHighlights(currentAreas: AreaInterface[]): AreaInterface[] {
    return currentAreas.map((a) => ({ ...a, canPostOn: false, canAttack: false }));
  }

  function endTurn() {
    if (modalSelectOption.active || modalSelectOption.area) {
      setModalSelectOption({ active: false });
    }
    setSelectedUnit(undefined);
    setPendingAction(null);
    setAreas(
      areas
        .map((area) => ({ ...area, canPostOn: false, canAttack: false }))
        .sort((a, b) => a.id - b.id)
    );
    // Clear extra turn UI state in App (changeTurn handles the actual turn switch)
    if (extraTurn) clearExtraTurn();
  }

  const pass = () => {
    if (!selectedUnit) return;
    socket.emit("pass", selectedUnit.unit);
    endTurn();
  };

  const stoleInit = () => {
    if (!selectedUnit) return;
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
    if (!selectedUnit) return;
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

  // -----------------------------------------------------------------------
  // Pending action helpers
  // -----------------------------------------------------------------------

  /** Called when Cavalerie/Soldat/Berserk player skips the optional second phase */
  const confirmAndEndPendingAction = () => {
    if (!pendingAction || !selectedUnit) return;

    switch (pendingAction.type) {
      case "cavalerie-moved":
        if (pendingAction.toAreaId === -1) {
          // No move, no attack — just cancel
          break;
        }
        // Moved but skipping attack — emit as normal move
        socket.emit(
          "cavalerieAction",
          pendingAction.fromAreaId,
          pendingAction.toAreaId,
          null,
          pendingAction.unit
        );
        break;
      case "soldat-attacked":
        if (pendingAction.attackedAreaId === -1) break; // nothing happened yet
        // Attack done, skip move
        socket.emit(
          "soldatAction",
          pendingAction.fromAreaId,
          pendingAction.attackedAreaId,
          null,
          pendingAction.unit
        );
        break;
      case "berserk-active": {
        const moves = pendingAction.moveHistory;
        socket.emit("berserkAction", moves, pendingAction.sacrifices, pendingAction.unit);
        break;
      }
      default:
        break;
    }
    endTurn();
  };

  // -----------------------------------------------------------------------
  // Main click on area handler
  // -----------------------------------------------------------------------
  const handleClickOnArea = (area: AreaInterface) => {
    if (!selectedUnit) return;

    // --- Cavalerie: move then optionally attack ---
    if (pendingAction?.type === "cavalerie-moved") {
      if (area.canAttack) {
        if (
          area.unitOnIt!.name === "Chevalier" &&
          (areas.find((a) => a.id === (pendingAction.toAreaId === -1 ? pendingAction.fromAreaId : pendingAction.toAreaId))?.unitOnIt?.reinforce ?? 0) < 2
        ) {
          updateMessages({ content: "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée", date: new Date().getTime() });
          return;
        }
        // toAreaId=-1 means unit didn't move yet → pass null
        const actualToAreaId = pendingAction.toAreaId === -1 ? null : pendingAction.toAreaId;
        socket.emit("cavalerieAction", pendingAction.fromAreaId, actualToAreaId, area.id, pendingAction.unit);
        endTurn();
      }
      return;
    }

    // --- Soldat: phase 1 = attack, phase 2 = optional move ---
    if (pendingAction?.type === "soldat-attacked") {
      if (pendingAction.attackedAreaId === -1) {
        // Phase 1: player must click an attack zone
        if (area.canAttack) {
          if (area.unitOnIt!.name === "Chevalier" && (areas.find((a) => a.id === pendingAction.fromAreaId)?.unitOnIt?.reinforce ?? 0) < 2) {
            updateMessages({ content: "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée", date: new Date().getTime() });
            return;
          }
          // Apply attack visually
          const afterAttack = areas.map((a) => {
            if (a.id === area.id) {
              return {
                ...a,
                unitOnIt: area.unitOnIt!.reinforce > 1
                  ? { ...area.unitOnIt!, reinforce: area.unitOnIt!.reinforce - 1 }
                  : null,
                canAttack: false,
              };
            }
            return { ...a, canAttack: false };
          });
          // Show movement zones for phase 2
          const fromArea = afterAttack.find((a) => a.id === pendingAction.fromAreaId)!;
          const withMove = afterAttack.map((a) => {
            if (fromArea.areasAround.includes(a.key) && !a.unitOnIt) {
              return { ...a, canPostOn: true };
            }
            return a;
          });
          setPendingAction({ ...pendingAction, attackedAreaId: area.id });
          setAreas(withMove);
        }
      } else {
        // Phase 2: optional move
        if (area.canPostOn && !area.unitOnIt) {
          socket.emit("soldatAction", pendingAction.fromAreaId, pendingAction.attackedAreaId, area.id, pendingAction.unit);
          endTurn();
        }
      }
      return;
    }

    // --- Phase N: Berserk (continue moving with reinforce sacrifice) ---
    if (pendingAction?.type === "berserk-active") {
      if (area.canPostOn && !area.unitOnIt) {
        const newMoves = [...pendingAction.moveHistory, area.id];
        const currentArea = areas.find((a) => a.id === pendingAction.currentAreaId)!;
        const unitReinforce = currentArea.unitOnIt?.reinforce ?? 1;

        // Move unit visually
        const updatedAreas = areas.map((a) => {
          if (a.id === pendingAction.currentAreaId) return { ...a, unitOnIt: null };
          if (a.id === area.id) return { ...a, unitOnIt: currentArea.unitOnIt };
          return a;
        });

        const canSacrificeAgain = unitReinforce - 1 > 1;
        if (canSacrificeAgain) {
          const newPending: PendingAction = {
            type: "berserk-active",
            currentAreaId: area.id,
            moveHistory: newMoves,
            sacrifices: pendingAction.sacrifices + 1,
            unit: pendingAction.unit,
          };
          setPendingAction(newPending);
          // Show next movement zones from new position
          const areaAtNewPos = { ...area, unitOnIt: currentArea.unitOnIt };
          const nextAreas = createMovement(
            "Berserk",
            areaAtNewPos,
            updatedAreas,
            players,
            socketTurn
          );
          setAreas(nextAreas);
        } else {
          // Last move, emit
          socket.emit("berserkAction", newMoves, pendingAction.sacrifices + 1, pendingAction.unit);
          endTurn();
        }
      }
      return;
    }

    // --- Phase 2: Porte-Étendard ally selection ---
    if (pendingAction?.type === "porte-etendard-select-ally") {
      if (area.canPostOn) {
        const allyUnit = area.unitOnIt!;
        const bannerArea = areas.find((a) => a.id === pendingAction.bannerAreaId)!;
        // Destination must be BOTH adjacent to the ally (1 step) AND within 2 cases of the banner
        const newAreas = clearHighlights(areas).map((a) => {
          const adjacentToAlly = area.areasAround.includes(a.key);
          const inBannerRange =
            bannerArea.areasAround.includes(a.key) ||
            bannerArea.areasAt2Cases.includes(a.key);
          if (adjacentToAlly && inBannerRange && !a.unitOnIt) {
            a.canPostOn = true;
          }
          return a;
        });
        setPendingAction({
          type: "porte-etendard-move-ally",
          bannerAreaId: pendingAction.bannerAreaId,
          allyFromAreaId: area.id,
          allyUnit,
          unit: pendingAction.unit,
        });
        setAreas(newAreas);
      }
      return;
    }

    // --- Phase 3: Porte-Étendard ally destination ---
    if (pendingAction?.type === "porte-etendard-move-ally") {
      if (area.canPostOn && !area.unitOnIt) {
        socket.emit(
          "portEtendardAction",
          pendingAction.bannerAreaId,
          pendingAction.allyFromAreaId,
          area.id,
          pendingAction.unit
        );
        endTurn();
      }
      return;
    }

    // --- Phase 2: Capitaine ally selection ---
    if (pendingAction?.type === "capitaine-select-ally") {
      if (area.canPostOn && area.unitOnIt) {
        const allyUnit = area.unitOnIt;
        // Show attack zones for this ally
        const newAreas = createMovement(allyUnit.name, area, clearHighlights(areas), players, socketTurn);
        // Only keep canAttack
        const attackOnlyAreas = newAreas.map((a) => ({ ...a, canPostOn: false }));
        setPendingAction({
          type: "capitaine-ally-attacks",
          captainAreaId: pendingAction.captainAreaId,
          allyAreaId: area.id,
          allyUnit,
          unit: pendingAction.unit,
        });
        setAreas(attackOnlyAreas);
      }
      return;
    }

    // --- Phase 3: Capitaine ally attacks ---
    if (pendingAction?.type === "capitaine-ally-attacks") {
      if (area.canAttack) {
        if (
          area.unitOnIt!.name === "Chevalier" &&
          areas.find((a) => a.id === pendingAction.allyAreaId)?.unitOnIt?.reinforce! < 2
        ) {
          updateMessages({ content: "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée", date: new Date().getTime() });
          return;
        }
        if (area.unitOnIt!.name === "Piquier") {
          socket.emit(
            "capitaineAction",
            pendingAction.captainAreaId,
            pendingAction.allyAreaId,
            area.id,
            pendingAction.unit
          );
        } else {
          socket.emit(
            "capitaineAction",
            pendingAction.captainAreaId,
            pendingAction.allyAreaId,
            area.id,
            pendingAction.unit
          );
        }
        endTurn();
      }
      return;
    }

    // --- Sceau Royal: move Garde Royale to a controlled zone within 2 cases ---
    if (pendingAction?.type === "sceau-royal") {
      if (area.canPostOn && !area.unitOnIt) {
        // Emit as a unit move: "postUnitOnGameBoard" with previousAreaId = gardeRoyale's area
        socket.emit(
          "postUnitOnGameBoard",
          area.id,
          pendingAction.unit,
          pendingAction.gardeRoyaleAreaId
        );
        endTurn();
      }
      return;
    }

    // --- Moine extra action: use the drawn piece like a normal hand token ---
    if (pendingAction?.type === "moine-extra") {
      if (area.canPostOn && !area.unitOnIt) {
        // Deploy the drawn unit to the board
        socket.emit("postUnitOnGameBoard", area.id, pendingAction.unit, undefined);
        endTurn();
      } else if (area.canAttack) {
        // Attack with the drawn unit (Moine acts as proxy)
        if (area.unitOnIt!.name === "Chevalier" && pendingAction.unit.name !== "Chevalier") {
          updateMessages({ content: "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée", date: new Date().getTime() });
          return;
        }
        socket.emit("attackUnit", area.id, pendingAction.unit, pendingAction.moineAreaId);
        endTurn();
      }
      return;
    }

    // --- Normal flow ---
    if (area.canPostOn && !area.unitOnIt) {
      socket.emit(
        "postUnitOnGameBoard",
        area.id,
        selectedUnit.unit,
        modalSelectOption.area?.id
      );
      endTurn();
    } else if (area.canAttack) {
      if (
        area.unitOnIt!.name === "Chevalier" &&
        modalSelectOption.area!.unitOnIt!.reinforce < 2
      ) {
        updateMessages({ content: "Vous ne pouvez attaquer un chevalier qu'avec une unité renforcée", date: new Date().getTime() });
        return;
      } else if (selectedUnit.unit.name === "Lancier" && modalSelectOption.area) {
        // Lancier charge: attack + move to the cell just in front of the enemy
        const lancierArea = modalSelectOption.area;
        const directions: [number, number][] = [[0,2],[0,-2],[-1,1],[-1,-1],[1,1],[1,-1]];
        let moveToAreaId: number | null = null;
        for (const [di, dj] of directions) {
          const k1 = `${lancierArea.i + di}_${lancierArea.j + dj}`;
          const k2 = `${lancierArea.i + 2 * di}_${lancierArea.j + 2 * dj}`;
          const k3 = `${lancierArea.i + 3 * di}_${lancierArea.j + 3 * dj}`;
          if (area.key === k2) {
            moveToAreaId = areas.find((a) => a.key === k1)?.id ?? null;
            break;
          }
          if (area.key === k3) {
            moveToAreaId = areas.find((a) => a.key === k2)?.id ?? null;
            break;
          }
        }
        socket.emit("lancierAction", lancierArea.id, moveToAreaId, area.id, selectedUnit.unit);
      } else if (
        area.unitOnIt!.name === "Piquier" &&
        area.areasAround.includes(modalSelectOption.area!.key)
      ) {
        // Piquier counter-attack only triggers when the attacker is adjacent (1 case)
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
      endTurn();
    }
  };

  // -----------------------------------------------------------------------
  // Modal movement handler
  // -----------------------------------------------------------------------
  const updateAreaByMovementOfUnit = (
    movement: MovementTypes,
    area: AreaInterface
  ) => {
    const unitName = area.unitOnIt!.name;

    switch (movement) {
      case "move": {
        if (unitName === "Cavalerie") {
          // Phase 1: only show movement zones (no attack yet)
          const newAreas = clearHighlights(areas).map((a) => {
            if (area.areasAround.includes(a.key) && !a.unitOnIt) {
              a.canPostOn = true;
            }
            return a;
          });
          // Also show direct attack (player can attack without moving)
          const withAttack = newAreas.map((a) => {
            if (
              area.areasAround.includes(a.key) &&
              a.unitOnIt &&
              unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
            ) {
              return { ...a, canAttack: true };
            }
            return a;
          });
          setPendingAction({
            type: "cavalerie-moved",
            fromAreaId: area.id,
            toAreaId: -1,
            unit: selectedUnit!.unit,
          });
          setModalSelectOption({ ...modalSelectOption, active: false });
          setAreas(withAttack);
          break;
        }

        if (unitName === "Soldat") {
          // Show attack zones (phase 1); if no enemy nearby, fall back to normal move
          const attackAreas = createMovement("Soldat", area, clearHighlights(areas), players, socketTurn);
          const hasAttackZones = attackAreas.some((a) => a.canAttack);
          if (hasAttackZones) {
            setPendingAction({
              type: "soldat-attacked",
              fromAreaId: area.id,
              attackedAreaId: -1,
              unit: selectedUnit!.unit,
            });
            setModalSelectOption({ ...modalSelectOption, active: false });
            setAreas(attackAreas);
          } else {
            // No enemies adjacent — just show normal movement zones
            const moveAreas = clearHighlights(areas).map((a) => {
              if (area.areasAround.includes(a.key) && !a.unitOnIt) a.canPostOn = true;
              return a;
            });
            setModalSelectOption({ ...modalSelectOption, active: false });
            setAreas(moveAreas);
          }
          break;
        }

        if (unitName === "Berserk") {
          const newAreas = createMovement("Berserk", area, clearHighlights(areas), players, socketTurn);
          setPendingAction({
            type: "berserk-active",
            currentAreaId: area.id,
            moveHistory: [area.id],
            sacrifices: 0,
            unit: selectedUnit!.unit,
          });
          setModalSelectOption({ ...modalSelectOption, active: false });
          setAreas(newAreas);
          break;
        }

        // Capitaine and Porte-Étendard: "Déplacer" = normal move;
        // their special abilities are on dedicated "ally-attack" / "ally-move" buttons
        const newAreas = createMovement(unitName, area, areas, players, socketTurn);
        setModalSelectOption({ ...modalSelectOption, active: false });
        setAreas(newAreas);
        break;
      }

      case "ally-attack": {
        // Capitaine: highlight allied units within 2 cases for ally selection
        const alliedAreas = clearHighlights(areas).map((a) => {
          const isAlly = a.unitOnIt && !unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn);
          const inRange = area.areasAround.includes(a.key) || area.areasAt2Cases.includes(a.key);
          if (isAlly && inRange) a.canPostOn = true;
          return a;
        });
        setPendingAction({
          type: "capitaine-select-ally",
          captainAreaId: area.id,
          unit: selectedUnit!.unit,
        });
        setModalSelectOption({ ...modalSelectOption, active: false });
        setAreas(alliedAreas);
        break;
      }

      case "ally-move": {
        // Porte-Étendard: highlight allied units within 2 cases for ally selection
        const alliedAreas = clearHighlights(areas).map((a) => {
          const isAlly = a.unitOnIt && !unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn);
          const inRange = area.areasAround.includes(a.key) || area.areasAt2Cases.includes(a.key);
          if (isAlly && inRange) a.canPostOn = true;
          return a;
        });
        setPendingAction({
          type: "porte-etendard-select-ally",
          bannerAreaId: area.id,
          unit: selectedUnit!.unit,
        });
        setModalSelectOption({ ...modalSelectOption, active: false });
        setAreas(alliedAreas);
        break;
      }

      case "reinforce":
        socket.emit("reinforceUnit", area.id, selectedUnit!.unit);
        endTurn();
        break;

      case "control":
        socket.emit("controlArea", area.id, selectedUnit!.unit);
        endTurn();
        break;

      default:
        console.log("unknown movement");
        return;
    }
  };

  // -----------------------------------------------------------------------
  // Cavalerie phase-2: intercept canPostOn click to trigger phase 2
  // -----------------------------------------------------------------------
  const handleCavalerieMoveClick = (area: AreaInterface) => {
    if (!pendingAction || pendingAction.type !== "cavalerie-moved") return;
    if (!area.canPostOn || area.unitOnIt) return;

    // Unit moves to new position (visually only)
    const fromArea = areas.find((a) => a.id === pendingAction.fromAreaId)!;
    const unitMoved = fromArea.unitOnIt!;
    const tempAreas = areas.map((a) => {
      if (a.id === pendingAction.fromAreaId) return { ...a, unitOnIt: null, canPostOn: false, canAttack: false };
      if (a.id === area.id) return { ...a, unitOnIt: unitMoved, canPostOn: false, canAttack: false };
      return { ...a, canPostOn: false, canAttack: false };
    });

    // Show attack zones from new position
    const areaAtNewPos = tempAreas.find((a) => a.id === area.id)!;
    const withAttack = tempAreas.map((a) => {
      if (
        areaAtNewPos.areasAround.includes(a.key) &&
        a.unitOnIt &&
        unitIsNotOneOfPlayer(a.unitOnIt, players, socketTurn)
      ) {
        return { ...a, canAttack: true };
      }
      return a;
    });

    setPendingAction({ ...pendingAction, toAreaId: area.id });
    setAreas(withAttack);
  };

  // -----------------------------------------------------------------------
  // Berserk move handler — called for every canPostOn click when berserk-active
  // First move (moveHistory.length === 1) is FREE; subsequent moves cost 1 reinforce.
  // -----------------------------------------------------------------------
  const handleBerserkFirstMove = (area: AreaInterface) => {
    if (!pendingAction || pendingAction.type !== "berserk-active") return;
    if (!area.canPostOn || area.unitOnIt) return;

    const fromArea = areas.find((a) => a.id === pendingAction.currentAreaId)!;
    const unitMoved = fromArea.unitOnIt!;
    const newMoves = [...pendingAction.moveHistory, area.id];
    const isFreeFistMove = pendingAction.moveHistory.length === 1;

    if (isFreeFistMove) {
      // First move is FREE — no reinforce cost
      const tempAreas = areas.map((a) => {
        if (a.id === pendingAction.currentAreaId) return { ...a, unitOnIt: null };
        if (a.id === area.id) return { ...a, unitOnIt: unitMoved };
        return a;
      });
      if (unitMoved.reinforce > 1) {
        // Can sacrifice for additional moves
        const areaAtNewPos = { ...area, unitOnIt: unitMoved };
        const nextMoveAreas = createMovement("Berserk", areaAtNewPos, tempAreas, players, socketTurn);
        setPendingAction({
          type: "berserk-active",
          currentAreaId: area.id,
          moveHistory: newMoves,
          sacrifices: 0,
          unit: pendingAction.unit,
        });
        setAreas(nextMoveAreas);
      } else {
        // Reinforce = 1: can't sacrifice, free move only
        socket.emit("berserkAction", newMoves, 0, pendingAction.unit);
        endTurn();
      }
    } else {
      // Sacrifice move — costs 1 reinforce (must keep at least 1 on the unit)
      if (unitMoved.reinforce <= 1) return; // safety: can't sacrifice last piece
      const newSacrifices = pendingAction.sacrifices + 1;
      const newReinforce = unitMoved.reinforce - 1;
      const tempAreas = areas.map((a) => {
        if (a.id === pendingAction.currentAreaId) return { ...a, unitOnIt: null };
        if (a.id === area.id) return { ...a, unitOnIt: { ...unitMoved, reinforce: newReinforce } };
        return a;
      });
      if (newReinforce > 1) {
        // Can sacrifice again
        const areaAtNewPos = { ...area, unitOnIt: { ...unitMoved, reinforce: newReinforce } };
        const nextMoveAreas = createMovement("Berserk", areaAtNewPos, tempAreas, players, socketTurn);
        setPendingAction({
          type: "berserk-active",
          currentAreaId: area.id,
          moveHistory: newMoves,
          sacrifices: newSacrifices,
          unit: pendingAction.unit,
        });
        setAreas(nextMoveAreas);
      } else {
        // Last sacrifice — emit
        socket.emit("berserkAction", newMoves, newSacrifices, pendingAction.unit);
        endTurn();
      }
    }
  };

  // -----------------------------------------------------------------------
  // Combined click dispatcher
  // -----------------------------------------------------------------------
  const onAreaClick = (area: AreaInterface) => {
    if (!isPlayerTurn() || !selectedUnit) return;

    if (pendingAction?.type === "cavalerie-moved" && area.canPostOn && !area.unitOnIt) {
      handleCavalerieMoveClick(area);
      return;
    }

    if (pendingAction?.type === "berserk-active" && area.canPostOn && !area.unitOnIt) {
      handleBerserkFirstMove(area);
      return;
    }

    handleClickOnArea(area);
  };

  const getHandTokenSrc = (unit: UnitInterface, playerIdx: 1 | 2): string => {
    if (unit.name === "Sceau Royal") return `${tokenPath}p${playerIdx}_royal_token.png`;
    return `${tokenPath}${unit.name.toLowerCase().replaceAll(" ", "_")}.png`;
  };

  // -----------------------------------------------------------------------
  // Render label for pending action phase
  // -----------------------------------------------------------------------
  const pendingLabel = () => {
    if (!pendingAction) return null;
    switch (pendingAction.type) {
      case "cavalerie-moved":
        return pendingAction.toAreaId === -1
          ? "Cavalerie : déplacez ou attaquez"
          : "Cavalerie : attaquez ou confirmez le déplacement";
      case "soldat-attacked":
        return "Soldat : déplacez-vous ou confirmez l'attaque";
      case "berserk-active":
        return `Berserk : sacrifiez un renfort pour continuer (${pendingAction.sacrifices} sacrifié(s))`;
      case "porte-etendard-select-ally":
        return "Porte-Étendard : choisissez un allié à déplacer";
      case "porte-etendard-move-ally":
        return "Porte-Étendard : choisissez la destination";
      case "capitaine-select-ally":
        return "Capitaine : choisissez un allié qui va attaquer";
      case "capitaine-ally-attacks":
        return "Capitaine : choisissez la cible de l'allié";
      case "moine-extra":
        return "Moine : jouez la pièce piochée";
      case "fantassin-second":
        return "Fantassin : activez le deuxième fantassin";
      case "sceau-royal":
        return "Sceau Royal : cliquez sur une zone contrôlée pour déplacer la Garde Royale";
      default:
        return null;
    }
  };

  const showConfirmSkip =
    pendingAction?.type === "cavalerie-moved" && pendingAction.toAreaId !== -1 ||
    pendingAction?.type === "soldat-attacked" && pendingAction.attackedAreaId !== -1 ||
    pendingAction?.type === "berserk-active";

  return (
    <div className={styles.boardGame}>
      <img src="images/Board_2P.png" alt="plateau de jeu" />
      {pendingLabel() && (
        <div className={styles.pendingLabel}>
          <span>{pendingLabel()}</span>
          {showConfirmSkip && (
            <button onClick={confirmAndEndPendingAction}>Confirmer</button>
          )}
        </div>
      )}
      {gardeRoyaleChoice && socket.id !== gardeRoyaleChoice.attackerSocketId && (
        <div className={styles.pendingLabel}>
          <span>Garde Royale attaquée — sacrifier une Garde Royale de la réserve ?</span>
          <button onClick={() => onGardeRoyaleSacrifice(gardeRoyaleChoice.areaId)}>
            Sacrifier
          </button>
          <button onClick={() => onGardeRoyaleDecline(gardeRoyaleChoice.areaId)}>
            Non (perdre le renfort)
          </button>
        </div>
      )}
      {areas.map((area) => (
        <div
          key={area.key}
          onClick={() => onAreaClick(area)}
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
                  <img
                    className={styles.unitCard}
                    src={`/images/cards/${unit.name.toLowerCase().replaceAll(" ", "_")}.jpg`}
                    alt={`carte ${unit.name}`}
                  />
                </div>
              ))}
            </div>
            <div>
              {players[1].hand.map((unit, index) => (
                <div key={index}>
                  <img
                    onClick={() =>
                      isPlayerProperty(players[1].socketId) &&
                      isPlayerTurn() &&
                      updateSelectedUnit(unit, index, players[1].id)
                    }
                    className={`${styles.bagToken} ${
                      selectedUnit &&
                      isPlayerProperty(players[1].socketId) &&
                      selectedUnit.unit.id === unit.id &&
                      selectedUnit.index === index &&
                      styles.selectedUnit
                    }`}
                    src={
                      players[1].socketId === socket.id
                        ? getHandTokenSrc(unit, 2)
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
                  <img
                    className={styles.unitCard}
                    src={`/images/cards/${unit.name.toLowerCase().replaceAll(" ", "_")}.jpg`}
                    alt={`carte ${unit.name}`}
                  />
                </div>
              ))}
            </div>
            <div>
              {players[0].hand.map((unit, index) => (
                <div key={index}>
                  <img
                    onClick={() =>
                      isPlayerProperty(players[0].socketId) &&
                      isPlayerTurn() &&
                      updateSelectedUnit(unit, index, players[0].id)
                    }
                    className={`${styles.bagToken} ${
                      selectedUnit &&
                      isPlayerProperty(players[0].socketId) &&
                      selectedUnit.unit.id === unit.id &&
                      selectedUnit.index === index &&
                      styles.selectedUnit
                    }`}
                    src={
                      players[0].socketId === socket.id
                        ? getHandTokenSrc(unit, 1)
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
      {winner !== 0 && (
        <div className={styles.winnerOverlay}>
          <div className={styles.winnerModal}>
            <h2>Victoire du Joueur {winner}&nbsp;!</h2>
            <p>Le joueur {winner} contrôle 6 zones.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoardGame;
