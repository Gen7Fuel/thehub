import { io, Socket } from "socket.io-client"

const socketUrl = "http://localhost:5000" ; // container networking

export const socket: Socket = io(socketUrl, {
  auth: { token: localStorage.getItem("token") },
  transports: ["websocket"],
  autoConnect: true,
});