import styles from "./gameConfig.module.css";
import { useEffect, useState } from "react";
import { GameConfigPropsType } from "../../@types/types";
import { RoomInterface, UnitInterface } from "../../@types/interfaces";
import Loader from "../../components/Loader/Loader";

function GameConfig(props: GameConfigPropsType) {
  const { username, updateUsername, socket } = props;
  const [inputName, setInputName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomList, setRoomList] = useState<RoomInterface[]>([]);
  const [error, setError] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  /**
   * When a name isn't stored in localStorage with key username.
   * @returns an error if username contain prohibed characters or if is empty
   */
  const handleNameInput = () => {
    if (inputName === "") {
      return setError("Vous avez oublié de renseigner un nom.");
    } else if (!/^[^<>\/\\]*$/.test(inputName)) {
      return setError(
        "Votre pseudo ne peut pas comporter les caractères < > et / ."
      );
    }
    setError("");
    updateUsername(inputName);
  };

  /**
   * create a room if no error encountered. socket serveur will emit roomList to update the list of active rooms
   * @returns an error is name is empty, contain prohibed characters, or already exist in roomList
   */
  const handleRoomInput = () => {
    if (roomName === "") {
      return setError("Vous avez oublié de renseigner un nom.");
    } else if (!/^[^<>\/\\]*$/.test(roomName)) {
      return setError(
        "Le nom de votre salle ne peut pas comporter les caractères < > et / ."
      );
    } else if (
      roomList.filter((room) => room.roomname === roomName).length !== 0
    ) {
      return setError("Une salle existe déjà avec ce nom.");
    }
    setError("");
    socket.emit("newRoom", roomName, username);
    setIsWaiting(true);
  };

  const joinSelectedRoom = (room: RoomInterface) => {
    if (room.nbPlayerIn >= 2) {
      return setError(
        "Le nombre maximal de joueur pour cette salle à été atteint."
      );
    }
    socket.emit("joinRoom", room, username);
    setIsWaiting(true);
  };

  const stopWaiting = () => {
    setIsWaiting(false);
    socket.emit("leaveRoom");
  };

  useEffect(() => {
    socket.emit("roomList");

    socket.on("listRoom", (data: RoomInterface[]) => {
      setRoomList(data);
    });

    socket.on(
      "join",
      (
        userjoin: string,
        unitsSelected: UnitInterface[],
        socketsIds: string[]
      ) => {
        props.updateSelectionUnits(unitsSelected);
        props.updateSocketConnected(userjoin);
        props.updatePlayersSocketId(socketsIds);
      }
    );

    return () => {
      socket.off("leaveRoom");
      socket.off("roomList");
      socket.off("listRoom");
      socket.off("join");
    };
  }, []);

  return (
    <div
      className={`${styles.selection} ${!username && styles.selectionCenter}`}
    >
      {!username ? (
        <>
          <label htmlFor="name">Nom d'utilisateur</label>
          <input
            id="name"
            type="text"
            value={inputName}
            pattern="^[^<>\/*%:&\\]*$"
            required
            placeholder="Entrez un pseudo"
            onInput={(e) => setInputName((e.target as HTMLInputElement).value)}
          />
          <button className={styles.validateButton} onClick={handleNameInput}>
            Valider
          </button>
          {error && <span className={styles.error}>{error}</span>}
        </>
      ) : (
        <>
          <label htmlFor="name">Créer une salle</label>
          <input
            id="name"
            type="text"
            value={roomName}
            pattern="^[^<>\/*%:&\\]*$"
            required
            placeholder="Entrez un nom pour votre salle"
            autoComplete="off"
            onInput={(e) => setRoomName((e.target as HTMLInputElement).value)}
          />
          <button className={styles.validateButton} onClick={handleRoomInput}>
            Créer
          </button>
          {error && <span className={styles.error}>{error}</span>}

          <p>Ou rejoindre une salle</p>
          <ul>
            {roomList.length !== 0 ? (
              roomList.map((room, index) => (
                <li key={index} onClick={() => joinSelectedRoom(room)}>
                  <div>
                    <span>Salle</span>
                    <span>Crée par</span>
                    <span>Nombre de joueurs</span>
                    <span>Rejoindre</span>
                  </div>
                  <div>
                    <span>{room.roomname}</span>
                    <span>{room.username}</span>
                    <span>{room.nbPlayerIn}/2</span>
                    <span>Button</span>
                  </div>
                </li>
              ))
            ) : (
              <small>Il n'y a encore aucune salle pour le moment...</small>
            )}
          </ul>
        </>
      )}
      {isWaiting && (
        <Loader absolute={true}>
          <span className={styles.waitingText}>
            En attente d'un autre joueur...
          </span>
          <button className={styles.Btn}>
            <div className={styles.sign}>
              <svg viewBox="0 0 512 512">
                <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path>
              </svg>
            </div>

            <div className={styles.text} onClick={() => stopWaiting()}>
              Quitter
            </div>
          </button>
        </Loader>
      )}
    </div>
  );
}

export default GameConfig;
