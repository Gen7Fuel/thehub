import { createContext, useRef, useEffect, useContext, type ReactNode, type MutableRefObject, useState } from 'react'
import { io, Socket } from "socket.io-client"
import { IncomingCallModal } from '@/components/custom/IncomingCallModal'

export interface User {
  id: string
  name: string
  email: string
}

export const getUserFromToken = (): User | null => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.user?.id || payload.id,
      name: payload.user?.name || payload.name,
      email: payload.user?.email || payload.email,
    };
  } catch (error) {
    console.error("Error parsing token:", error);
    return null;
  }
};

interface SocketContextType {
  socketRef: MutableRefObject<Socket | null>
  reconnect: () => void
  peerConnectionRef: MutableRefObject<RTCPeerConnection | null>
  localStreamRef: MutableRefObject<MediaStream | null>
  remoteStreamRef: MutableRefObject<MediaStream | null>
  screenStreamRef: MutableRefObject<MediaStream | null>
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const [incomingCall, setIncomingCall] = useState<{ senderId: string, offer: RTCSessionDescriptionInit, callerName?: string } | null>(null);

  const handleAcceptCall = async () => {
    if (!incomingCall || !socketRef.current) return;

    try {
      console.log("✅ Call accepted, setting up connection...");

      // Create peer connection
      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Handle incoming tracks (caller's audio)
      peerConnectionRef.current.ontrack = (event) => {
        console.log("🎥 Received remote track:", event.track.kind);
        console.log("   Track state:", event.track.readyState);
        console.log("   Track muted:", event.track.muted);
        remoteStreamRef.current = event.streams[0];
        window.dispatchEvent(new CustomEvent('remote-stream', { 
          detail: { stream: event.streams[0] } 
        }));
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("🧊 Sending ICE candidate");
          socketRef.current!.emit('ice-candidate', { 
            candidate: event.candidate, 
            target: incomingCall.senderId 
          });
        }
      };

      // Monitor connection state
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log("🔄 Connection state:", peerConnectionRef.current?.connectionState);
      };

      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log("🧊 ICE connection state:", peerConnectionRef.current?.iceConnectionState);
      };

      // Get audio (microphone)
      console.log("🎤 Requesting audio...");
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      console.log("✅ Got audio stream:", audioStream);
      console.log("   Audio tracks:", audioStream.getAudioTracks());

      // Get screen share
      console.log("🖥️ Requesting screen share...");
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always" as any,
          displaySurface: "monitor"  // ✅ Prefer full screen
        },
        audio: true  // ✅ Try to capture system audio too
      } as DisplayMediaStreamOptions);
      console.log("✅ Got screen share:", screenStream);
      console.log("   Video tracks:", screenStream.getVideoTracks());
      console.log("   Audio tracks:", screenStream.getAudioTracks());

      screenStreamRef.current = screenStream;

      // Add audio track from microphone
      audioStream.getAudioTracks().forEach(track => {
        console.log("➕ Adding audio track:", track.label);
        peerConnectionRef.current!.addTrack(track, audioStream);
      });

      // Add screen video track
      screenStream.getVideoTracks().forEach(track => {
        console.log("➕ Adding video track:", track.label);
        peerConnectionRef.current!.addTrack(track, screenStream);
      });

      // Add screen audio track if available
      screenStream.getAudioTracks().forEach(track => {
        console.log("➕ Adding screen audio track:", track.label);
        peerConnectionRef.current!.addTrack(track, screenStream);
      });

      localStreamRef.current = audioStream;

      // Dispatch event for UI
      window.dispatchEvent(new CustomEvent('local-stream', { 
        detail: { stream: audioStream } 
      }));
      window.dispatchEvent(new CustomEvent('screen-stream', { 
        detail: { stream: screenStream } 
      }));

      // Set remote description (the offer)
      console.log("📝 Setting remote description...");
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );
      console.log("✅ Remote description set");

      // Create and send answer
      console.log("📤 Creating answer...");
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log("✅ Answer created");

      socketRef.current.emit('answer', { 
        answer, 
        target: incomingCall.senderId 
      });
      console.log("📤 Sent answer to:", incomingCall.senderId);

      setIncomingCall(null);

    } catch (error) {
      console.error("❌ Error accepting call:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIncomingCall(null);
    }
  };

  // const handleAcceptCall = async () => {
  //   if (!incomingCall || !socketRef.current) return;

  //   try {
  //     console.log("✅ Call accepted, setting up connection...");

  //     // Create peer connection
  //     const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  //     peerConnectionRef.current = new RTCPeerConnection(configuration);

  //     // Handle incoming tracks (caller's audio)
  //     peerConnectionRef.current.ontrack = (event) => {
  //       console.log("🎥 Received remote track:", event.track.kind);
  //       remoteStreamRef.current = event.streams[0];
  //       window.dispatchEvent(new CustomEvent('remote-stream', { 
  //         detail: { stream: event.streams[0] } 
  //       }));
  //     };

  //     // Handle ICE candidates
  //     peerConnectionRef.current.onicecandidate = (event) => {
  //       if (event.candidate) {
  //         socketRef.current!.emit('ice-candidate', { 
  //           candidate: event.candidate, 
  //           target: incomingCall.senderId 
  //         });
  //       }
  //     };

  //     // Get audio (microphone)
  //     const audioStream = await navigator.mediaDevices.getUserMedia({ 
  //       audio: true,
  //       video: false 
  //     });
  //     console.log("🎤 Got audio stream");

  //     // Get screen share
  //     const screenStream = await navigator.mediaDevices.getDisplayMedia({
  //       video: {
  //         cursor: "always"
  //       } as any,
  //       audio: false
  //     });
  //     console.log("🖥️ Got screen share");

  //     screenStreamRef.current = screenStream;

  //     // Add audio track
  //     audioStream.getAudioTracks().forEach(track => {
  //       peerConnectionRef.current!.addTrack(track, audioStream);
  //     });

  //     // Add screen video track
  //     screenStream.getVideoTracks().forEach(track => {
  //       peerConnectionRef.current!.addTrack(track, screenStream);
  //     });

  //     localStreamRef.current = audioStream;

  //     // Dispatch event for UI
  //     window.dispatchEvent(new CustomEvent('local-stream', { 
  //       detail: { stream: audioStream } 
  //     }));
  //     window.dispatchEvent(new CustomEvent('screen-stream', { 
  //       detail: { stream: screenStream } 
  //     }));

  //     // Set remote description (the offer)
  //     await peerConnectionRef.current.setRemoteDescription(
  //       new RTCSessionDescription(incomingCall.offer)
  //     );

  //     // Create and send answer
  //     const answer = await peerConnectionRef.current.createAnswer();
  //     await peerConnectionRef.current.setLocalDescription(answer);

  //     socketRef.current.emit('answer', { 
  //       answer, 
  //       target: incomingCall.senderId 
  //     });
  //     console.log("📤 Sent answer to:", incomingCall.senderId);

  //     setIncomingCall(null);

  //   } catch (error) {
  //     console.error("❌ Error accepting call:", error);
  //     setIncomingCall(null);
  //   }
  // };

  const handleRejectCall = () => {
    if (!incomingCall || !socketRef.current) return;

    console.log("❌ Call rejected");
    socketRef.current.emit('call-rejected', { 
      target: incomingCall.senderId 
    });
    setIncomingCall(null);
  };

  const connect = (user: User) => {
    if (socketRef.current?.connected) return;

    console.log('🔌 Connecting socket for:', user.email);

    const socket = io("https://app.gen7fuel.com", {
      path: "/signaling/socket.io",
      query: { username: user.email.split("@")[0] },
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);
      const room = `${user.email.split("@")[0]}'s room`;
      socket.emit("join-room", room);
      console.log("📍 Joined:", room);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected");
    });

    socket.on("user-connected", (socketId: string) => {
      console.log("👤 User connected to room:", socketId);
    });

    socket.on("user-disconnected", (socketId: string) => {
      console.log("👋 User disconnected from room:", socketId);
    });

    // Handle incoming call offers - show modal instead of auto-accepting
    socket.on("offer", async (message: { offer: RTCSessionDescriptionInit, sender: string }) => {
      console.log("📞 Incoming call from:", message.sender);
      
      // Show incoming call modal
      setIncomingCall({
        senderId: message.sender,
        offer: message.offer,
        callerName: "Support Team"
      });
    });

    // Handle incoming answers (when you made the call)
    socket.on("answer", async (message: { answer: RTCSessionDescriptionInit, sender: string }) => {
      console.log("📥 Received answer from:", message.sender);
      
      if (peerConnectionRef.current && message.answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(message.answer)
          );
          console.log("✅ Remote description set");
        } catch (error) {
          console.error("❌ Error setting remote description:", error);
        }
      }
    });

    // Handle ICE candidates
    socket.on("ice-candidate", async (message: { candidate: RTCIceCandidateInit, sender: string }) => {
      console.log("🧊 Received ICE candidate from:", message.sender);
      
      if (peerConnectionRef.current && message.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(message.candidate)
          );
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      }
    });

    // Handle call rejection
    socket.on("call-rejected", () => {
      console.log("❌ Call was rejected by user");
      alert("The user rejected your call");
      
      // Clean up
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    });

    socketRef.current = socket;
  };

  const reconnect = () => {
    const user = getUserFromToken();
    if (user) connect(user);
  };

  useEffect(() => {
    const user = getUserFromToken();
    if (user) connect(user);

    const handleUserLoggedIn = () => {
      console.log("👂 Received user-logged-in event");
      const userData = getUserFromToken();
      if (userData) connect(userData);
    };

    window.addEventListener("user-logged-in", handleUserLoggedIn);

    return () => {
      window.removeEventListener("user-logged-in", handleUserLoggedIn);
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socketRef, 
      reconnect, 
      peerConnectionRef,
      localStreamRef,
      remoteStreamRef,
      screenStreamRef
    }}>
      {children}
      <IncomingCallModal 
        callerInfo={incomingCall}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  return context;
};