import { io, Socket } from "socket.io-client";

const socketUrl = 
  window.location.hostname === "localhost" 
    ? "http://localhost:5000"
    : "https://app.gen7fuel.com:5000";

let socket: Socket | null = null;
let currentUrl: string | null = null;

export function getSocket(): Socket {
  // Recreate socket if URL changed (handles hot reloads/rebuilds)
  if (!socket || currentUrl !== socketUrl) {
    if (socket) {
      socket.disconnect();
    }
    
    socket = io(socketUrl, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
      autoConnect: true,
    });
    
    currentUrl = socketUrl;
  }
  
  return socket;
}