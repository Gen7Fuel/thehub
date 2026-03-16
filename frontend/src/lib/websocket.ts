import { io, Socket } from "socket.io-client";

const socketUrl = "/"; 
const supportSocketUrl = "/support"; // Support namespace

let socket: Socket | null = null;
let supportSocket: Socket | null = null;
let currentUrl: string | null = null;
let currentSupportUrl: string | null = null;

export function getSocket(): Socket {
  console.log("🔧 getSocket() called");
  console.log("🔧 Current socketUrl:", socketUrl);
  
  if (!socket || currentUrl !== socketUrl) {
    if (socket) {
      console.log("🔄 Disconnecting old socket:", socket.id);
      socket.disconnect();
    }
    
    console.log("🚀 Creating new socket connection to:", socketUrl);
    
    const token = localStorage.getItem("token");
    console.log("🔑 Using auth token:", token ? "present" : "missing");
    
    socket = io(socketUrl, {
      path: "/socket.io",
      // Socket.io allows auth to be a function! 
      // This ensures the LATEST token is sent on every reconnect attempt.
      auth: (cb) => {
        cb({ token: localStorage.getItem("token") });
      },
      // auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: 20000,
      // forceNew: true
    });
    
    currentUrl = socketUrl;

    // Your existing event handlers...
    socket.on("connect", () => {
      console.log("✅ Main Socket CONNECTED successfully!");
      console.log("📡 Socket ID:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Main Socket DISCONNECTED:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("🚨 Main Socket CONNECTION ERROR:", err);
    });
  }
  
  return socket;
}

// New function for support socket
export function getSupportSocket(): Socket {
  console.log("🔧 getSupportSocket() called");
  console.log("🔧 Current supportSocketUrl:", supportSocketUrl);
  
  if (!supportSocket || currentSupportUrl !== supportSocketUrl) {
    if (supportSocket) {
      console.log("🔄 Disconnecting old support socket:", supportSocket.id);
      supportSocket.disconnect();
    }
    
    console.log("🚀 Creating new support socket connection to:", supportSocketUrl);
    
    const token = localStorage.getItem("token");
    console.log("🔑 Using auth token for support:", token ? "present" : "missing");
    
    supportSocket = io(supportSocketUrl, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      timeout: 20000,
      forceNew: true
    });
    
    currentSupportUrl = supportSocketUrl;

    supportSocket.on("connect", () => {
      console.log("✅ Support Socket CONNECTED successfully!");
      console.log("📡 Support Socket ID:", supportSocket?.id);
    });

    supportSocket.on("disconnect", (reason) => {
      console.log("❌ Support Socket DISCONNECTED:", reason);
    });

    supportSocket.on("connect_error", (err) => {
      console.error("🚨 Support Socket CONNECTION ERROR:", err);
    });

    supportSocket.on("error", (error) => {
      console.error("🔥 Support Socket ERROR:", error);
    });
  }
  
  return supportSocket;
}

// Cleanup function
export function disconnectSupportSocket() {
  if (supportSocket) {
    console.log("🔄 Disconnecting support socket");
    supportSocket.disconnect();
    supportSocket = null;
    currentSupportUrl = null;
  }
}

// import { io, Socket } from "socket.io-client";

// const socketUrl = "/"; 

// let socket: Socket | null = null;
// let currentUrl: string | null = null;

// export function getSocket(): Socket {
//   console.log("🔧 getSocket() called");
//   console.log("🔧 Current socketUrl:", socketUrl);
//   console.log("🔧 Current location:", window.location.href);
//   console.log("🔧 Existing socket:", socket ? socket.id : "none");
//   console.log("🔧 Current URL:", currentUrl);

//   if (!socket || currentUrl !== socketUrl) {
//     if (socket) {
//       console.log("🔄 Disconnecting old socket:", socket.id);
//       socket.disconnect();
//     }
    
//     console.log("🚀 Creating new socket connection to:", socketUrl);
//     console.log("🌐 Full URL will be:", window.location.origin + socketUrl);
    
//     // Get token from localStorage
//     const token = localStorage.getItem("token");
//     console.log("🔑 Using auth token:", token ? "present" : "missing");

//     socket = io(socketUrl, {
//       path: "/socket.io",
//       auth: { token },
//       transports: ["websocket", "polling"], // Add polling as fallback
//       autoConnect: true,
//       timeout: 20000,
//       forceNew: true
//     });
    
//     currentUrl = socketUrl;

//     // Detailed connection logging
//     socket.on("connect", () => {
//       console.log("✅ Socket CONNECTED successfully!");
//       console.log("📡 Socket ID:", socket?.id);
//       console.log("🚀 Transport:", socket?.io.engine.transport.name);
//       console.log("🔗 Socket URL:", socket?.io.opts?.hostname ? `${socket.io.opts.hostname}:${socket.io.opts.port}${socket.io.opts.path}` : socketUrl);
//     });

//     socket.on("disconnect", (reason) => {
//       console.log("❌ Socket DISCONNECTED:", reason);
//     });

//     socket.on("connect_error", (err) => {
//       console.error("🚨 Socket CONNECTION ERROR:", err);
//       console.error("🚨 Error message:", err.message);
//       console.error("🚨 Error type:", (err as any).type ?? "N/A");
//       console.error("🚨 Error description:", (err as any)?.description ?? "N/A");
//     });

//     socket.on("error", (error) => {
//       console.error("🔥 Socket ERROR:", error);
//     });

//     // Log transport events
//     socket.io.on("error", (error) => {
//       console.error("⚡ Socket.IO Manager ERROR:", error);
//     });

//     socket.io.engine.on("upgrade", () => {
//       console.log("⬆️ Transport UPGRADED to:", socket?.io.engine.transport.name);
//     });

//     socket.io.engine.on("upgradeError", (error) => {
//       console.error("⬆️ Transport UPGRADE ERROR:", error);
//     });
//   }
  
//   return socket;
// }

