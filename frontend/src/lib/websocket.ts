// import { io, Socket } from "socket.io-client"

// const socketUrl = "http://localhost:5000" ; // container networking

// export const socket: Socket = io(socketUrl, {
//   auth: { token: localStorage.getItem("token") },
//   transports: ["websocket"],
//   autoConnect: true,
// });

// src/lib/websocket.ts
import { io, Socket } from "socket.io-client";

const socketUrl = "http://app.gen7fuel.com:5000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}
