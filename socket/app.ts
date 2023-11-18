import * as http from "http";
import { Server } from "socket.io";
import { units } from "./src/datas/units";
import {
  PlayerInterface,
  RoomInterface,
  UnitInterface,
} from "./src/@types/interface";
import { RecruitUnitsAtStart } from "./src/helpers/recruitUnitAtStart";
import { createPlayerHand } from "./src/helpers/createPlayerHand";

const httpServer = http.createServer();
// const socketio = require("socket.io");

const io = new Server(httpServer, {
  cors: {
    credentials: true,
    origin: ["http://localhost:5173", "http://192.168.1.10:5173"],
    methods: ["GET", "POST"],
  },
});

const UnitsInRooms: { room: string; units: UnitInterface[] }[] = [];

function getCreatedRooms(): RoomInterface[] {
  const rooms = Array.from(io.sockets.adapter.rooms.entries());
  const ArrayOfRoomCreatedWithPlayerInIt: RoomInterface[] = [];
  rooms.forEach((room) => {
    if (room[0].startsWith("Game//") && room[1].size < 2) {
      ArrayOfRoomCreatedWithPlayerInIt.push({
        username: room[0].split("//")[1],
        roomname: room[0].split("//")[2],
        nbPlayerIn: room[1].size,
      });
    }
  });
  return ArrayOfRoomCreatedWithPlayerInIt;
}

function getSocketRoom(socket: any): string {
  return Array.from(socket.rooms).find((room) => room !== socket.id) as string;
}

/**
 *when socket join a room, clear the previous room joined
 * @param socket the socket trying to join a new room
 * @returns nothing
 */
function leaveActualRoom(socket: any) {
  const rooms: Set<string> = socket.rooms;
  if (rooms.size < 2) {
    return;
  }
  for (const room of rooms) {
    if (room !== socket.id) {
      socket.leave(room);
    }
  }
}

/**
 * create a set on 8 differents numbers, then create an array of 8 units.
 * Register it with the room name and send it to the socket on the room
 * @returns the units displayed for a specific room
 */
function createArrayOfAleatoryNumber(room: string): UnitInterface[] {
  const aleatoryNumbers = new Set<number>();
  while (aleatoryNumbers.size < 8) {
    const number = Math.ceil(Math.random() * 16);
    aleatoryNumbers.add(number);
  }
  const unitsToSendToRoom = Array.from(aleatoryNumbers).map(
    (number) => units.find((unit) => unit.id === number)!
  );
  UnitsInRooms.push({ room, units: unitsToSendToRoom });
  return unitsToSendToRoom;
}

io.on("connection", (socket) => {
  socket.on("roomList", () => {
    io.emit("listRoom", getCreatedRooms());
  });

  socket.on("newRoom", (roomName: string, username: string) => {
    leaveActualRoom(socket);
    socket.join(`Game//${username}//${roomName}`);
    io.emit("listRoom", getCreatedRooms());
  });

  socket.on("leaveRoom", () => {
    leaveActualRoom(socket);
    io.emit("listRoom", getCreatedRooms());
  });

  socket.on("joinRoom", (room: RoomInterface, name: string) => {
    leaveActualRoom(socket);
    const joinedRoom = `Game//${room.username}//${room.roomname}`;
    const arrayOfUnits = createArrayOfAleatoryNumber(joinedRoom);
    socket.join(joinedRoom);
    const connectedSockets = Array.from(
      io.sockets.adapter.rooms.get(joinedRoom)!
    );
    io.to(joinedRoom).emit("join", name, arrayOfUnits, connectedSockets);
  });

  //socket event for prepare game

  socket.on("selectUnit", (unitId: number) => {
    const room = getSocketRoom(socket);
    const roomInConcern = UnitsInRooms.find((game) => game.room === room)!;
    const unitInConcern = roomInConcern.units.find(
      (unit) => unit.id === unitId
    );
    roomInConcern.units = roomInConcern.units.filter(
      (unit) => unit.id !== unitId
    );
    io.to(room).emit(
      "unitSelected",
      unitInConcern,
      roomInConcern.units,
      socket.id
    );
  });

  socket.on("gameSelectionEnded", (players: PlayerInterface[]) => {
    const room = getSocketRoom(socket);
    const indexOfRoomToDelete = UnitsInRooms.findIndex(
      (game) => game.room === room
    );
    UnitsInRooms.splice(indexOfRoomToDelete, 1);

    const newPlayers = players.map((player) => {
      const unitInBag = RecruitUnitsAtStart(player.units);
      return { ...player, bag: unitInBag };
    });
    const isP1Init = Math.random() < 0.5 ? true : false;
    io.to(room).emit("launchGame", newPlayers, isP1Init);
  });

  //socket event for game

  socket.on("makePlayersHand", (players: PlayerInterface[]) => {
    const room = getSocketRoom(socket);
    const newPlayers = players.map((player) => {
      if (player.bag.length < 3) {
        player.bag = [...player.bag, ...player.unitOnHold];
        player.unitOnHold = [];
      }
      const hand = createPlayerHand(player.bag);
      return { ...player, hand };
    });
    io.to(room).emit("playerHandDone", newPlayers);
  });

  socket.on("pass", (usedUnit: UnitInterface) => {
    const room = getSocketRoom(socket);
    io.to(room).emit("passed", socket.id, usedUnit);
  });

  socket.on("stoleInit", (usedUnit: UnitInterface) => {
    const room = getSocketRoom(socket);
    io.to(room).emit("initStole", socket.id, usedUnit);
  });

  socket.on(
    "recrutUnit",
    (recrutedUnit: UnitInterface, usedUnit: UnitInterface) => {
      const room = getSocketRoom(socket);
      io.to(room).emit("unitRecruted", socket.id, usedUnit, recrutedUnit);
    }
  );

  socket.on(
    "postUnitOnGameBoard",
    (
      areaId: number,
      usedUnit: UnitInterface,
      previousAreaId: number | undefined
    ) => {
      const room = getSocketRoom(socket);
      if (previousAreaId) {
        io.to(room).emit(
          "gameBoardUnitMoved",
          socket.id,
          areaId,
          usedUnit,
          previousAreaId
        );
      } else {
        io.to(room).emit("gameBoardUnitPosted", socket.id, areaId, usedUnit);
      }
    }
  );

  socket.on("reinforceUnit", (areaId: number, usedUnit: UnitInterface) => {
    const room = getSocketRoom(socket);
    io.to(room).emit("unitReinforced", socket.id, areaId, usedUnit);
  });

  socket.on("controlArea", (areaId: number, usedUnit: UnitInterface) => {
    const room = getSocketRoom(socket);
    io.to(room).emit("areaControlled", socket.id, areaId, usedUnit);
  });

  socket.on(
    "attackUnit",
    (areaId: number, usedUnit: UnitInterface, ownAreaId: number) => {
      const room = getSocketRoom(socket);
      io.to(room).emit("unitAttacked", socket.id, areaId, usedUnit, ownAreaId);
    }
  );

  socket.on(
    "attackAndSacrifice",
    (areaId: number, usedUnit: UnitInterface, areaIdWithOwnUnit: number) => {
      const room = getSocketRoom(socket);
      io.to(room).emit(
        "sacrificeForUnitAttack",
        socket.id,
        areaId,
        usedUnit,
        areaIdWithOwnUnit
      );
    }
  );

  //socket event for chat

  socket.on("createMessage", (content: string, username: string) => {
    const room = getSocketRoom(socket);
    const date = new Date().getTime();
    const socketId = socket.id;
    io.to(room).emit("newMessage", { socketId, username, content, date });
  });

  socket.on("error", (err: any) => {
    console.log(err);
  });
});

httpServer.listen(3000);
