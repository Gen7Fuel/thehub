import { io, Socket } from "socket.io-client";

const socketUrl = "/"; // Adjust if needed

let socket: Socket | null = null;
let currentUrl: string | null = null;

export function getSocket(): Socket {
  // Recreate socket if URL changed (handles hot reloads/rebuilds)
  if (!socket || currentUrl !== socketUrl) {
    if (socket) {
      socket.disconnect();
    }
    
    socket = io(socketUrl, {
      path: "/socket.io",
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
      autoConnect: true,
    });
    
    currentUrl = socketUrl;
  }
  
  return socket;
}