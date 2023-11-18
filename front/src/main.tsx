import React from "react";
import ReactDOM from "react-dom/client";
import App from "./Pages/App/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* depuis le 2/11/2023
unités fini: 4/16 [éclaireur, cavalerie légère, piquier, chevalier ]
archer, arbalétrier, cavalerie légère: bloquer accès à case 2 si case 1 innaccessible
fantassin à moitié: ma logique cause des erreurs jusqu'à même la sélection d'unités... 

des fois (quand on selectionne du txt je crois) la sélection ne fonctionne plus
a un moment j'ai volé le token init une deuxieme fois et ca marchait plus
le piquier ne marche pas, je sais pas pourquoi. Sa case reste rouge et il ne se passe rien
sinon, aussi pouvoir déplacer le second fantassin
OH, et ce foutu putain de royal token tu le met quand bordel (ne peut pas poser le royalToken)


scroll auto dans le chat (no important)
chat: comme en entreprise: scroll pas auto si pas tout en bas, et affiche 'new messages' (no important)


FANTASSIN 
tu peux dans l'interval créer une div absolute z-index 999 stopPropagation qui bloque l'accès aux 2 players espaces

quand clique sur Fantassin dans main, sur le terrain illumine les deux (un map pour setAreas)
clique sur 1 et emet event, totalement normal, et transmet l'event
dans App, fait le mouvement, actualise le bordel, SAUF le playerTurn
ensuite, filter le boardGame et find si il y a un autre endroit avec Fantassin
passe AnotherTurn a true, et useEffect avec anotherTurn en dépendance dans boardGame
là, passe selectedUnit à fantassin, l'area ou il est, et modalSelectOptions avec ce qu'il faut pour qu'elle apparaisse
si annuler passe son tour.
Met également la div pour empecher de cliquer sur sa main ou le token adv

ARCHER    
voir comment empecher une attaque si il y a une unité devant


ARBALETRIER
pareil que archer, voir comment empecher une attaque si il y a une unité devant

PORTE ETENDARD
un peu comme capitaine, mais l'unité selectionné ne peut que se déplacer dans une des même cases
oh la merde, en plus si le porte etendard déplace un berserk alors le berserk peut utiliser sa tactique


LANCIER
en fait en dessous non, car faut vérifier qu'une unité peut être attaque avant de le déplacer
assez chiant, déja il peut attaquer unité que à areaAt2Cases, mais aussi a 3 cases
mais seulement en ligne droite
en gros, tu pourrais faire que quand il se déplace, n'émet pas d'event, demande juste direct à l'user s'il veut continuer
tu ne le fais pas jouer, tu l'avance de 1 dans la même direction, puis tu redemande
avance de 1 ou attaque. Si avancé, et que devant il y a un ennemi, demande si attaque
et quand il selectionne non, emet l'event

donc areaAround en vert, et canAttack en ligne droite à 2 ou 3

CAPITAINE
faudrait dans la modale d'option une case en plus: utiliser tactique
regarde les unités à 1 ou 2 cases et les fait briller
sélectionne en 1 et peut la déplacer.
a voir le comportement car la tu dépense 1 capitaine pour bouger une autre unité
capitaine peut activer tactique du moine, berserk et soldat. il ne peut pas faire attaquer l'archer ou le lancier

MERCENAIRE
hmm... chiant, car quand tu le recrute il peut rejouer, donc très fort en début de partie, mais on s'en fou
en gros, quand recrute unité, vérifie si recrute un mercenaire et si il y en a 1 sur le terrain.
Si non passe
si oui demande si veut le déplacer, et déplace le conventionnellement

BERSERK
un peu comme fantassin, un event spécial qui fait le bordel.
vérifie que le berserk.reinforce > 1
emet un event qui demande si veut continuer à bouger ?
si non beh fait le reste de la logique
si oui fait l'évenement spécial, retire 1 au reinforce, et redéplace en bloquand les players spaces


GARDE ROYALE
peut être déplacé que avec sceau royal, chiant putain la j'ai pas d'idée
quand attaqué, regarde si unit attaqué == garde royale, comme piquier et chevalier
si oui, demande ennemi si veut depenser une unité dans sa caserne ?
si non fait normal, si oui laisse l'unit sur le terrain et retire 1 de barrack

SOLDAT
un peu comme Cavalerie mais à l'inverse
si à attaqué, demande si veut se déplacer
bloque les players space et n'authorise que le déplacement.
ensuite émet les event normaux

MOINE
je pense que ça va être horrible
une fois que bougé, pour atk ou controle, pioche une unité du sacet dois la jouer immédiatement
donc emet events, et si pièce joué === moine et que attack ou control, pioche pièce du sac... WTF merde comment faire ?
  aléatoire, dois la jouer immédiatement, la encore...


bouger une unité en fonction de sa tactique de déplacement
attaquer une unité en fonction de sa tactique d'attaque
implémenter le reste des tactiques unités
*/

/* token de 460*400, ok ça passe limite pour le *1.16
on App, redirected to GameConfig
choose username if not stored in localStorage, then create or join a room
when room have 2 members update players with socket.id, and pass to GameSelection
la socket à envoyé l'id de celle qui doit jouer et les id des cartes choisies pour la partie


lorsqu'un joueur choisit une carte, il emet l'id de celle ci. La sacket renvoie cet id
il faut adapter le tableau de depart en retirant cet id. et ainsi adapter la liste de cartes restantes
si le tbCartesRestantes.length % 2 !== 0 il faut modifier la valeur de socketId qui doit jouer.
lorsque tbCartesRestantes.length === 0 GameSelection est fini et on arrive sur BoardGame
avant, toujours dans app, launchGame: prépare le bag des players ainsi que leur hand
avec fonction qui refait leur main chaque 6 tour (3 / 3)

le joueur qui reçoit l'initiative commence. Il sélectionne une unité dans sa main
en brillance l'unité sélectionné et les areas sur lesquelles elle peut être posé (canPostOn)
tout les mouvements vérifient l'id de la socket de l'user et s'il à bien sélectionné une unité qui lui appartient
peut passer (remet area et selectedUnit à défault)
peut voler l'initiative (commencera la prochaine manche, lors du renouvellement de la main)
  l'initiative peut être volé que 1x par round
voit sur le plateau les zones ou il peut poser l'unité (en surbrillance) et peut poser une unité dessus

peut renforcer une unité posé
ou bouger une unité selon les déplacements de l'unité
si est sur une zone de controle peut aussi controller la zone




* quand j'appelle socket.on dans useEffect pour modifier une valeur, 
j'ai l'impression que useEffect lui passe une ancienne valeur 
 = celle du state qu'il avait stocké lors de son exécution on dirait
du coup, si on lui passe en dépendance la valeur, il se réactualise 
et çà à l'air de fonctionner
useEffect garderait des valeurs de state en référence...
çà expliquerait pourquoi les enfants one une valeur correcte
ça expliquerait pourquoi dans Component de Chrome c'est correct
et ça expliquerait tout mon problème

*/
