import {
  AreaInterface,
  PlayerInterface,
  UnitInterface,
} from "../@types/interface";
import { unitIsNotOneOfPlayer } from "../helpers/verifyUnitAppartenance";

export const units: UnitInterface[] = [
  {
    id: 1,
    name: "Fantassin",
    cap: "Peut être déployée 2 fois sur le terrain et effectuer une manoeuvre avec chacun d'eux.",
    nb: 5,
    //faut vérifier si il y a un autre fantassin après son mouvement et le faire jouer, socket après
  },
  {
    id: 2,
    name: "Archer",
    cap: "Ne peut attaquer une unité qu'à 2 cases de distance. La case intermédiaire doit être libre",
    nb: 4,
  },
  {
    id: 3,
    name: "Cavalerie",
    cap: "Se déplace puis attaque.",
    nb: 4,
    //après déplacement, montre attaque, socket après
  },
  {
    id: 4,
    name: "Cavalerie légère",
    cap: "se déplace de 1 ou 2 cases.",
    nb: 5,
  },
  {
    id: 5,
    name: "Arbalétrier",
    cap: "Peut attaquer une unité à 1 ou 2 cases si la case intermédiaire est libre.",
    nb: 5,
  },
  {
    id: 6,
    name: "Porte étendard",
    cap: "Choisissez une unité alliée qui se trouve à 2 cases ou moins. vous pouvez la déplacer vers une case qui se trouve également à 2 cases ou moins du porte étendard.",
    nb: 5,
  },
  {
    id: 7,
    name: "Chevalier",
    cap: "Ne peut être attaqué que par des unités renforcées.",
    nb: 4,
    //ça se fait sans rien de plus, juste un autre param dans emit
  },
  {
    id: 8,
    name: "Lancier",
    cap: "Se déplace de 1 ou 2 cases puis attaque. Toujours en ligne droite.",
    nb: 4,
    //calcule les zones à 2 ou 3 case en ligne droite avec i et j
    //en plus des conditions autres
    //met en vert les comme les autres et en rouge les condition du haut
  },
  {
    id: 9,
    name: "Capitaine",
    cap: "Choisi une unité à 2 cases ou moins. Elle peut attaquer.",
    nb: 5,
  },
  {
    id: 10,
    name: "Mercenaire",
    cap: "Lorsque vous recrutez un mercenaire, vous pouvez effectuer directement une manoeuvre.",
    nb: 5,
  },
  {
    id: 11,
    name: "Berserk",
    cap: "Après une manoeuvre, peut défausser une pièce de renfort pour en effectuer une autre, autant de fois qu'i reste de renfort.",
    nb: 5,
    //pour l'instant tu fais tout les move puis la socket après (tu indique dans message le nombre de sacrifice)
  },
  {
    id: 12,
    name: "Piquier",
    cap: "Lorsqu'attaqué, retire une pièce de l'unité attaquante.",
    nb: 4,
    //pareil que chevalier, juste un autre param dans emit
  },
  {
    id: 13,
    name: "Éclaireur",
    cap: "Peut être déployée sur une case adjacente à une unité alliée.",
    nb: 5,
    //normalement c'est ok
  },
  {
    id: 14,
    name: "Garde Royale",
    cap: "Défaussez le sceau royal pour avancer la garde royale. Lorsqu'attaqué, vous pouvez retirer une pièce de votre réserve à la place de celle sur le terrain.",
    nb: 5,
  },
  {
    id: 15,
    name: "Soldat",
    cap: "Peut se déplacer après avoir attaqué.",
    nb: 5,
    //après une attaque, montre un déplacement. Socket après
  },
  {
    id: 16,
    name: "Moine",
    cap: "après une attaque ou un contrôle, pioche une pièce du sac et l'utilise immédiatement pour n'importe quelle action",
    nb: 4,
  },
];
