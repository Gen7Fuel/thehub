import { io, Socket } from "socket.io-client";

const socketUrl = "/"; 

let socket: Socket | null = null;
let currentUrl: string | null = null;

export function getSocket(): Socket {
  console.log("🔧 getSocket() called");
  console.log("🔧 Current socketUrl:", socketUrl);
  console.log("🔧 Current location:", window.location.href);
  console.log("🔧 Existing socket:", socket ? socket.id : "none");
  console.log("🔧 Current URL:", currentUrl);

  if (!socket || currentUrl !== socketUrl) {
    if (socket) {
      console.log("🔄 Disconnecting old socket:", socket.id);
      socket.disconnect();
    }
    
    console.log("🚀 Creating new socket connection to:", socketUrl);
    console.log("🌐 Full URL will be:", window.location.origin + socketUrl);
    
    // Get token from localStorage
    const token = localStorage.getItem("token");
    console.log("🔑 Using auth token:", token ? "present" : "missing");

    socket = io(socketUrl, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"], // Add polling as fallback
      autoConnect: true,
      timeout: 20000,
      forceNew: true
    });
    
    currentUrl = socketUrl;

    // Detailed connection logging
    socket.on("connect", () => {
      console.log("✅ Socket CONNECTED successfully!");
      console.log("📡 Socket ID:", socket?.id);
      console.log("🚀 Transport:", socket?.io.engine.transport.name);
      console.log("🔗 Socket URL:", socket?.io.opts?.hostname ? `${socket.io.opts.hostname}:${socket.io.opts.port}${socket.io.opts.path}` : socketUrl);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket DISCONNECTED:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("🚨 Socket CONNECTION ERROR:", err);
      console.error("🚨 Error message:", err.message);
      console.error("🚨 Error type:", (err as any).type ?? "N/A");
      console.error("🚨 Error description:", (err as any)?.description ?? "N/A");
    });

    socket.on("error", (error) => {
      console.error("🔥 Socket ERROR:", error);
    });

    // Log transport events
    socket.io.on("error", (error) => {
      console.error("⚡ Socket.IO Manager ERROR:", error);
    });

    socket.io.engine.on("upgrade", () => {
      console.log("⬆️ Transport UPGRADED to:", socket?.io.engine.transport.name);
    });

    socket.io.engine.on("upgradeError", (error) => {
      console.error("⬆️ Transport UPGRADE ERROR:", error);
    });
  }
  
  return socket;
}
// import { io, Socket } from "socket.io-client";

// const socketUrl = "/"; // Adjust if needed

// let socket: Socket | null = null;
// let currentUrl: string | null = null;

// export function getSocket(): Socket {
//   // Recreate socket if URL changed (handles hot reloads/rebuilds)
//   if (!socket || currentUrl !== socketUrl) {
//     if (socket) {
//       socket.disconnect();
//     }
    
//     socket = io(socketUrl, {
//       path: "/socket.io",
//       // auth: { token: localStorage.getItem("token") },
//       transports: ["websocket"],
//       autoConnect: true,
//     });
    
//     currentUrl = socketUrl;

//     // Debug logging
//     socket.on("connect", () => console.log("Socket connected:", socket ? socket.id : "unknown"));
//     socket.on("disconnect", () => console.log("Socket disconnected"));
//     socket.on("connect_error", (err) => console.error("Socket connection error:", err));
//   }
  
//   return socket;
// }