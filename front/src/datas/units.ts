import {
  AreaInterface,
  PlayerInterface,
  UnitInterface,
} from "../@types/interfaces";
import { unitIsNotOneOfPlayer } from "../utils/verifyUnitAppartenance";

const tokenPath = "/images/tokens/";
const cardPath = "/images/cards/";

export const units: UnitInterface[] = [
  {
    id: 1,
    name: "Fantassin",
    cap: "",
    nb: 5,
  },
  {
    id: 2,
    name: "Archer",
    cap: "",
    nb: 4,
  },
  {
    id: 3,
    name: "Cavalerie",
    cap: "",
    nb: 4,
  },
  {
    id: 4,
    name: "Cavalerie légère",
    cap: "",
    nb: 5,
  },
  {
    id: 5,
    name: "Arbalétrier",
    cap: "",
    nb: 5,
  },
  {
    id: 6,
    name: "Porte étendard",
    cap: "",
    nb: 5,
  },
  {
    id: 7,
    name: "Chevalier",
    cap: "",
    nb: 4,
  },
  {
    id: 8,
    name: "Lancier",
    cap: "",
    nb: 4,
  },
  {
    id: 9,
    name: "Capitaine",
    cap: "",
    nb: 5,
  },
  {
    id: 10,
    name: "Mercenaire",
    cap: "",
    nb: 5,
  },
  {
    id: 11,
    name: "Berserk",
    cap: "",
    nb: 5,
  },
  {
    id: 12,
    name: "Piquier",
    cap: "",
    nb: 4,
  },
  {
    id: 13,
    name: "Éclaireur",
    cap: "",
    nb: 5,
  },
  {
    id: 14,
    name: "Garde Royale",
    cap: "",
    nb: 5,
  },
  {
    id: 15,
    name: "Soldat",
    cap: "",
    nb: 5,
  },
  {
    id: 16,
    name: "Moine",
    cap: "",
    nb: 4,
  },
];
