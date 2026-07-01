import { Socket } from "socket.io-client";
import {
  AreaInterface,
  MessageInterface,
  PlayerInterface,
  UnitInterface,
} from "../interfaces";
import { ReactNode } from "react";
import { MovementTypes } from "./movementTypes";

export type BoardGamePropsType = {
  players: PlayerInterface[];
  startGame: boolean;
  boardGame: AreaInterface[];
  initiative: boolean;
  initAlreadyStole: boolean;
  socket: Socket;
  socketTurn: string;
  updateMessages: (arg0: MessageInterface) => void;
  extraTurn: { socketId: string; areaId: number; type: "fantassin" | "mercenaire" | "moine"; drawnUnit?: UnitInterface } | null;
  clearExtraTurn: () => void;
  gardeRoyaleChoice: { attackerSocketId: string; areaId: number } | null;
  onGardeRoyaleSacrifice: (areaId: number) => void;
  onGardeRoyaleDecline: (areaId: number) => void;
};

export type ChatPropsType = {
  socket: Socket;
  messages: MessageInterface[];
};

export type GameConfigPropsType = {
  username: string;
  socket: Socket;
  updateUsername: (arg0: string) => void;
  updateSocketConnected: (arg0: string) => void;
  updateSelectionUnits: (arg0: UnitInterface[]) => void;
  updatePlayersSocketId: (arg0: string[]) => void;
};

export type GameDetailsPropsType = {
  players: PlayerInterface[];
  socket: Socket;
  socketTurn: string;
};

export type GameSelectionPropsType = {
  unitsSelection: UnitInterface[];
  socket: Socket;
  players: PlayerInterface[];
  socketTurn: string;
  setInGameSelection: (arg0: boolean) => void;
};

export type LoaderPropsType = {
  absolute?: boolean;
  children?: ReactNode;
};

export type ModalSelectOptionPropsType = {
  modalSelectOption: {
    active: boolean;
    area?: AreaInterface;
    playerId?: number;
    disableReinforce?: boolean;
  };
  updateModalSelection: (arg0: boolean) => void;
  updateAreaByMovementOfUnit: (
    arg0: MovementTypes,
    arg1: AreaInterface
  ) => void;
};
