# WarChest — État du projet

## Architecture

```
/front   → React + Vite (TypeScript)  — interface joueur
/socket  → Node.js + Socket.IO (TypeScript)  — serveur de jeu
```

Le serveur socket est un **relay pur** : il reçoit un événement d'un client et le réémet à tous les clients de la room (`io.to(room).emit`). Il ne valide rien, ne calcule rien. Toute la logique de jeu (déplacements valides, conditions, état du plateau) est **côté client React**.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `socket/app.ts` | Tous les handlers socket (relay) |
| `socket/src/datas/units.ts` | 17 unités avec id, name, cap, nb |
| `socket/src/helpers/recruitUnitAtStart.ts` | Peuple le sac de départ : 2 de chaque unité sélectionnée + 1 Sceau Royal |
| `socket/src/helpers/createPlayerHand.ts` | Pioche 3 pièces aléatoires du sac pour la main |
| `front/src/Pages/App/App.tsx` | État global React — écoute tous les events socket, gère `players`, `boardGame`, `socketTurn`, `initiative`, `extraTurn`, `gardeRoyaleChoice` |
| `front/src/components/BoardGame/BoardGame.tsx` | Composant plateau — gère les clics, `pendingAction`, highlights, et émet les events socket |
| `front/src/utils/createMovement.ts` | Calcule les zones `canPostOn` (vert) et `canAttack` (rouge) selon l'unité |
| `front/src/utils/createBoard.ts` | Génère le plateau hexagonal (`AreaInterface[]`) avec `areasAround` et `areasAt2Cases` |
| `front/src/components/ModalSelectOption/ModalSelectOption.tsx` | Modal d'action (Déplacer, Renforcer, Contrôler + boutons spéciaux selon unité) |
| `front/src/components/GameSelection/GameSelection.tsx` | Phase de sélection des 8 unités |
| `front/src/config/socketConfig.ts` | Connexion socket — lit `VITE_SOCKET_URL` depuis `.env` |
| `front/.env` | URL du serveur socket. Actuellement : `http://192.168.1.10:3000` |

---

## Interfaces principales

### `PlayerInterface`
```typescript
{
  id: 1 | 2,
  socketId: string,
  initToken: string,               // chemin image token d'initiative
  units: UnitInterface[],          // BARAQUE : unités avec nb restant à recruter
  bag: UnitInterface[],            // SAC : pièces disponibles à piocher
  hand: UnitInterface[],           // MAIN : 3 pièces du tour en cours
  unitOnHold: UnitOnReposeInterface[], // RÉSERVE (côté) : pièces jouées ce round
  graveyard: UnitInterface[],      // cimetière (unités détruites)
}
```

### `AreaInterface`
```typescript
{
  id: number,
  i: number, j: number,           // coordonnées hexagonales
  key: string,                    // "i_j"
  controlPoint: boolean,
  controlledBy: number | null,    // player.id
  unitOnIt: UnitOnBoardInterface | null,
  canPostOn: boolean,             // surbrillance verte (mouvement / déploiement)
  canAttack: boolean,             // surbrillance rouge (attaque)
  areasAround: string[],          // 6 voisins directs (1 case)
  areasAt2Cases: string[],        // toutes zones à 2 cases (12 entrées)
}
```

### Grille hexagonale
- Lignes `i` : 2 à 8 (lignes 0, 1, 9, 10 inutilisées)
- 6 directions : `[0,±2]`, `[-1,±1]`, `[+1,±1]`
- `areasAt2Cases` inclut **toutes** les zones à 2 pas (pas seulement en ligne droite)
- Pour le calcul en ligne droite (Lancier) : utiliser les formules `i±di`, `j±dj` manuellement

---

## Flux de jeu complet

### 1. Lobby
- `GameConfig` → 2 joueurs se connectent → `joinRoom`

### 2. Sélection (GameSelection)
- 8 unités tirées aléatoirement et affichées
- Les joueurs choisissent en alternance, 4 chacun
- `gameSelectionEnded` → serveur → `RecruitUnitsAtStart` → `launchGame`

### 3. Démarrage d'un round
- `makePlayersHand` → `createPlayerHand` pioche 3 pièces du sac → `playerHandDone`
- Le sac se réapprovisionne depuis `unitOnHold` si moins de 3 pièces restantes

### 4. Tour d'un joueur
1. Sélectionner une unité depuis **sa main** → `updateSelectedUnit` → zones surlignées
2. **Option A** — action directe depuis la main : passer, voler l'initiative, recruter
3. **Option B** — clic sur une unité sur le plateau → **modal** → Déplacer / Renforcer / Contrôler / (boutons spéciaux selon l'unité)
4. Clic sur une zone ou validation → émission socket → `changeTurn` dans App.tsx

### 5. Rechargement des mains
- Toutes les 6 actions (`nbTurn % 6 === 0`) → `makePlayersHand`
- Si main + sac vides en milieu de round → auto-pass (voir ci-dessous)

### Auto-pass (main + sac vides)
- `useEffect` sur `[socketTurn, players]` dans App.tsx
- Joueur actif sans main ni sac → `socket.emit("pass", dummyUnit)` + message
- Les deux joueurs sans rien → `makePlayersHand` forcé
- `removePlayedUnitFromHand` est protégé : si unité non trouvée dans la main (`findIndex === -1`), la manipulation est annulée silencieusement

---

## Système `pendingAction` (BoardGame.tsx)

État local qui gère les actions **multi-phases**. **Effacé automatiquement à chaque nouvelle sélection de main** via `setPendingAction(null)` au début de `updateSelectedUnit`.

| Type | Comment se déclenche | Phases |
|---|---|---|
| `cavalerie-moved` | "Déplacer" sur Cavalerie | Phase 1 : mouvement optionnel. Phase 2 : attaque optionnelle depuis la nouvelle position. Bouton "Confirmer" pour stopper. |
| `soldat-attacked` | "Déplacer" sur Soldat | Si ennemi adjacent : phase 1 attaque → phase 2 déplacement optionnel. Si aucun ennemi : déplacement normal. |
| `berserk-active` | "Déplacer" sur Berserk | Mouvement libre. Si `reinforce > 1` : propose de sacrifier 1 renfort pour refaire. "Confirmer" pour arrêter. |
| `porte-etendard-select-ally` | "Déplacer un allié" | Phase 1 : surbrillance des alliés ≤2 cases. |
| `porte-etendard-move-ally` | Sélection d'un allié | Phase 2 : destination = **adjacent à l'allié ET ≤2 cases du PE** (intersection). |
| `capitaine-select-ally` | "Faire attaquer un allié" | Phase 1 : surbrillance des alliés ≤2 cases. |
| `capitaine-ally-attacks` | Sélection d'un allié | Phase 2 : zones d'attaque de l'allié. |
| `sceau-royal` | Sélection Sceau Royal en main | Si Garde Royale sur terrain : surligne zones contrôlées ≤2 cases de la GR. Clic → déplace la GR via `postUnitOnGameBoard`. |
| `moine-extra` | Réception `moineUnitDrawn` | Surligne zones de déploiement pour la pièce piochée. Clic → `postUnitOnGameBoard` ou `attackUnit`. |

---

## Système `extraTurn` (App.tsx)

Accordé après certaines actions. Bloque `changeTurn` jusqu'à résolution. `changeTurn` efface toujours `extraTurn` (via `setExtraTurn(null)`).

| Type | Déclencheur | Comportement BoardGame |
|---|---|---|
| `"fantassin"` | Move/contrôle/renfort avec un Fantassin, si un 2e existe sur le terrain | Modal auto-ouverte sur le 2e Fantassin. `fantassinExtraActiveRef = true` empêche la boucle infinie. |
| `"mercenaire"` | Recrutement d'un Mercenaire si un Mercenaire est déjà sur le terrain | Modal auto-ouverte sur le Mercenaire terrain. `disableReinforce: true` dans la modal. |
| `"moine"` | Attaque ou contrôle avec le Moine | Pioche synchronisée via socket (`moineDrawBroadcast` → `moineUnitDrawn`). Zones de déploiement pour la pièce piochée. |

---

## Toutes les unités

| ID | Unité | Statut | Règle implémentée |
|---|---|---|---|
| 1 | **Fantassin** | ✅ | 2 peuvent coexister sur le terrain. Manœuvre avec l'un → extra-tour pour l'autre. |
| 2 | **Archer** | ✅ | Attaque uniquement à 2 cases (case intermédiaire vide). Déplacement 1 case. |
| 3 | **Cavalerie** | ✅ | Déplace (optionnel) puis attaque (optionnel). `pendingAction: cavalerie-moved`, `toAreaId = -1` si pas encore bougé. |
| 4 | **Cavalerie légère** | ✅ | Déplacement 1 ou 2 cases, attaque à 1 case. |
| 5 | **Arbalétrier** | ✅ | Attaque à 1 ou 2 cases si case intermédiaire vide. |
| 6 | **Porte-Étendard** | ✅ | "Déplacer" = se déplace lui-même. "Déplacer un allié" : allié ≤2 cases → destination à 1 case de l'allié ET ≤2 cases du PE. |
| 7 | **Chevalier** | ✅ | Seule une unité avec `reinforce ≥ 2` peut l'attaquer. Vérifié côté client avant l'émission. |
| 8 | **Lancier** | ✅ | Attaque en ligne droite à exactement 2 ou 3 cases (6 directions hexagonales, cases intermédiaires vides). |
| 9 | **Capitaine** | ✅ | "Déplacer" = normal. "Faire attaquer un allié" → allié ≤2 cases effectue une attaque. |
| 10 | **Mercenaire** | ✅ | Après recrutement, si un Mercenaire est sur le terrain : extra-tour pour lui (sans renforcement). |
| 11 | **Berserk** | ✅ | Premier déplacement gratuit. Tant que `reinforce > 1` : peut sacrifier 1 renfort par déplacement supplémentaire. |
| 12 | **Piquier** | ✅ | Contre-attaque **uniquement si l'attaquant est adjacent** (`areasAround`). Les attaques à distance (Archer, Lancier…) = `attackUnit` normal. |
| 13 | **Éclaireur** | ✅ | Déploiement adjacent à n'importe quelle unité alliée sur le terrain. |
| 14 | **Garde Royale** | ✅ | Déplacée via Sceau Royal (1 ou 2 cases vers une zone contrôlée). Quand attaquée : si une GR est dans `unitOnHold`, le défenseur peut la sacrifier à la place. |
| 15 | **Soldat** | ✅ | Si ennemi adjacent : attaque obligatoire en premier, puis déplacement optionnel. Sinon : déplacement normal. |
| 16 | **Moine** | ✅ | Après attaque ou contrôle : pioche aléatoire dans le sac (sync via `moineDrawBroadcast`). La pièce piochée s'utilise pour n'importe quelle action standard. |
| 17 | **Sceau Royal** | ✅ | 1 par joueur dans le sac au départ. Utilisable pour passer / recruter / voler l'initiative. Avec une GR sur le terrain : la déplace de 1 ou 2 cases vers une zone contrôlée. Token spécifique à chaque joueur (`p1_royal_token.png` / `p2_royal_token.png`). |

---

## Événements Socket — référence complète

### Hérités
| Client → Serveur | Serveur → Room | Description |
|---|---|---|
| `pass(unit)` | `passed(socketId, unit)` | Passer son tour |
| `stoleInit(unit)` | `initStole(socketId, unit)` | Voler l'initiative |
| `recrutUnit(recruited, used)` | `unitRecruted(socketId, used, recruited)` | Recruter |
| `postUnitOnGameBoard(areaId, unit, prevId?)` | `gameBoardUnitPosted` ou `gameBoardUnitMoved` | Déployer ou déplacer |
| `reinforceUnit(areaId, unit)` | `unitReinforced(socketId, areaId, unit)` | Renforcer |
| `controlArea(areaId, unit)` | `areaControlled(socketId, areaId, unit)` | Contrôler |
| `attackUnit(areaId, unit, ownAreaId)` | `unitAttacked(socketId, areaId, unit, ownAreaId)` | Attaque normale |
| `attackAndSacrifice(areaId, unit, ownAreaId)` | `sacrificeForUnitAttack(socketId, areaId, unit, ownAreaId)` | Attaque Piquier adjacent |
| `makePlayersHand(players)` | `playerHandDone(newPlayers)` | Recharger les mains |

### Ajoutés
| Client → Serveur | Serveur → Room | Description |
|---|---|---|
| `cavalerieAction(from, to\|null, attack\|null, unit)` | `cavalerieActed` | Cavalerie : move + attack |
| `soldatAction(from, attack, to\|null, unit)` | `soldatActed` | Soldat : attack + move |
| `berserkAction(moves[], sacrifices, unit)` | `berserkActed` | Berserk : chaîne |
| `portEtendardAction(banner, allyFrom, allyTo, unit)` | `portEtendardActed` | Porte-Étendard : allié déplacé |
| `capitaineAction(captain, ally, attack, unit)` | `capitaineActed` | Capitaine : allié attaque |
| `gardeRoyaleSacrifice(areaId, unit)` | `gardeRoyaleSacrificed` | GR sacrifie depuis réserve |
| `moineDrawBroadcast(drawnUnit, moineAreaId)` | `moineUnitDrawn(socketId, drawnUnit, moineAreaId)` | Synchronise la pioche Moine |

---

## Images / Assets

| Dossier | Contenu |
|---|---|
| `/public/images/tokens/` | Tokens unités `.png`, `p1/p2_royal_token.png`, `p1/p2_init_token.png`, `bag.png`, `hidden_token.png` |
| `/public/images/cards/` | Cartes unités `.jpg` — hover dans la baraque et dans GameSelection |
| `/public/images/Board_2P.png` | Image fond plateau |

Chemin token standard : `tokenPath + unit.name.toLowerCase().replaceAll(" ", "_") + ".png"`.
Exception : Sceau Royal → `p1_royal_token.png` (players[0]) ou `p2_royal_token.png` (players[1]).

---

## Points d'attention pour la suite

- **Validation serveur absente** : aucune vérification côté serveur. Un client malveillant peut envoyer n'importe quoi.
- **Garde Royale sacrifice** : `attackUnitOnBoardGame` est appelé **avant** que le défenseur choisisse. Si le défenseur sacrifie, la GR terrain a quand même perdu un renfort ET le sacrifice est prélevé de la réserve. À corriger pour être 100% fidèle aux règles.
- **Moine + Sceau Royal** : si le Moine pioche un Sceau Royal, ce dernier s'affiche comme une unité deployable sans zones — edge case non traité.
- **Berserk** : l'UI montre l'unité qui "avance" visuellement, mais le serveur reçoit et applique toute la chaîne en une fois (`berserkActed`).
- **Condition de victoire** : `isWinner` dans `front/src/utils/isWinner.ts` détecte 6 points de contrôle. L'affichage d'une modale de victoire n'est pas encore implémenté (seulement un `console.log`).
