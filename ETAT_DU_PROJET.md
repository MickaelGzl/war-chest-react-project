# WarChest — État du projet

## Architecture

- **`/front`** — React + Vite (TypeScript)
- **`/socket`** — Node.js + Socket.IO (TypeScript)

Pas de backend REST séparé dans ce projet. Toute la logique de jeu est dans le serveur Socket.

---

## Ce qui est fonctionnel

### Lobby & setup
- Création/rejoindre une room
- Phase de sélection des 8 unités (alternée)
- Distribution des mains depuis les sacs (toutes les 6 actions)

### Mécanique de jeu de base
- Système de tours et d'initiative
- Vol d'initiative
- Recrutement d'unité (baraque → sac)
- Déploiement sur une case contrôlée
- **Déplacement** — handler complet côté socket et front
- **Attaque** — handler complet avec suppression de renfort ou destruction
- **Contrôle de point** — handler complet, met à jour `controlledBy`
- **Renforcement** — incrémente `reinforce` sur l'unité
- Condition de victoire : 6 points de contrôle

### Unités avec logique spéciale déjà codée
| Unité | Ce qui est fait |
|---|---|
| **Archer** | Attaque/déplacement à 2 cases (case intermédiaire libre requise) |
| **Arbalétrier** | Attaque/déplacement à 1-2 cases (case intermédiaire libre requise) |
| **Cavalerie légère** | Déplacement à 1-2 cases, attaque à 1 case seulement |
| **Chevalier** | Ne peut être attaqué que par une unité avec renfort ≥ 1 |
| **Piquier** | Contre-attaque : l'attaquant perd aussi une unité (socket `attackAndSacrifice`) |
| **Éclaireur** | Peut se déployer adjacent à n'importe quel allié déjà sur le terrain |

### Chat
- Système de chat en temps réel entre joueurs

---

## Ce qui reste à faire

### Unités sans logique spéciale (stubs)

| Unité | Capacité à implémenter | Notes dans le code |
|---|---|---|
| **Lancier** (id 8) | Déplacement/attaque en ligne droite à 2-3 cases | Commentaire : "calcule les zones à 2 ou 3 cases en ligne droite avec i et j" |
| **Cavalerie** (id 3) | Déplacer *puis* attaquer dans le même tour | Commentaire : "après déplacement, montre attaque, socket après" |
| **Soldat** (id 15) | Attaquer *puis* se déplacer dans le même tour | Commentaire : "après une attaque, montre un déplacement" |
| **Berserk** (id 11) | Action supplémentaire en sacrifiant un niveau de renfort | Commentaire : "tu fais tous les moves puis la socket après" |
| **Fantassin** (id 1) | Déployer 2 unités si seulement 1 Fantassin sur le terrain | Commentaire : "faut vérifier si il y a un autre fantassin après son mouvement" |
| **Mercenaire** (id 10) | Manœuvre gratuite immédiate après recrutement (sans dépenser de carte) | Commentaire : "juste un autre param dans emit" |
| **Porte-Étendard** (id 6) | Déplacer un allié adjacent (à 1 case) | Non commencé |
| **Capitaine** (id 9) | Faire attaquer un allié dans un rayon de 2 cases | Non commencé |
| **Moine** (id 16) | Piocher dans le sac après attaque ou contrôle et jouer la pièce tirée | Non commencé — **confirmer règle exacte avec le propriétaire** |
| **Garde Royale** (id 14) | Attaque retire une pièce de la main/sac adverse plutôt que du terrain | Non commencé — **confirmer règle exacte avec le propriétaire** |

### Améliorations générales à prévoir
- Validation des mouvements côté serveur (actuellement surtout côté client)
- Gestion des erreurs de désynchronisation socket/état de jeu
- Tests sur les cas limites (sac vide, plus d'unités disponibles, etc.)

---

## Fichiers clés à connaître

| Fichier | Rôle |
|---|---|
| `socket/src/datas/units.ts` | Définitions des 16 unités + logique de mouvement spécial |
| `socket/app.ts` | Tous les handlers socket (attaque, déplacement, contrôle...) |
| `front/src/components/BoardGame.tsx` | Composant principal — clics sur cases, modal d'action |
| `front/src/utils/createMovement.ts` | Calcul des cases accessibles selon l'unité |
| `front/src/utils/isWinner.ts` | Condition de victoire |
| `front/src/datas/areas.ts` | Définition du plateau et des points de contrôle |

---

## Ordre suggéré pour continuer

1. **Lancier** — logique géométrique pure (ligne droite), pas d'ambiguïté sur les règles
2. **Cavalerie / Soldat** — double action dans un tour (move → attack ou attack → move)
3. **Berserk** — extra action avec sacrifice de renfort
4. **Fantassin** — double déploiement conditionnel
5. **Mercenaire** — tour gratuit après recrutement
6. **Porte-Étendard** — sélection d'un allié à déplacer
7. **Capitaine** — délégation d'attaque à un allié
8. **Moine** — pioche et rejeu (confirmer règles)
9. **Garde Royale** — mécanique de main/sac adverse (confirmer règles)
