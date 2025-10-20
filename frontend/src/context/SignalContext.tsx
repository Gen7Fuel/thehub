import { createContext, useRef, useEffect, useContext, type ReactNode, type MutableRefObject, useState } from 'react'
import { io, Socket } from "socket.io-client"
import { IncomingCallModal } from '@/components/custom/IncomingCallModal'
import { ActiveAudioCall } from '@/components/custom/ActiveAudioCall'

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
  isCallActive: boolean
  endCall: () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const [incomingCall, setIncomingCall] = useState<{ senderId: string, offer: RTCSessionDescriptionInit, callerName?: string } | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [otherUserName, setOtherUserName] = useState<string>('');
  const [otherUserRoom, setOtherUserRoom] = useState<string>('');

  const endCall = () => {
    console.log("📞 Ending call...");
    
    // Notify other user - use room OR socket ID
    if (socketRef.current) {
      const target = otherUserRoom || incomingCall?.senderId;  // ✅ FIXED
      if (target) {
        socketRef.current.emit('call-ended', { target });
        console.log(`📤 Sent call-ended to: ${target}`);
      }
    }
    
    // Clean up peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    remoteStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    
    // Reset state
    setIsCallActive(false);
    setIncomingCall(null);
    setOtherUserName('');
    setOtherUserRoom('');  // ✅ Clear room
    
    console.log("✅ Call ended");
  };
  // const endCall = () => {
  //   console.log("📞 Ending call...");
    
  //   // Notify other user
  //   if (socketRef.current && incomingCall?.senderId) {
  //     socketRef.current.emit('call-ended', { target: incomingCall.senderId });
  //   }
    
  //   // Clean up peer connection
  //   if (peerConnectionRef.current) {
  //     peerConnectionRef.current.close();
  //     peerConnectionRef.current = null;
  //   }
    
  //   // Stop all tracks
  //   localStreamRef.current?.getTracks().forEach(track => track.stop());
  //   remoteStreamRef.current?.getTracks().forEach(track => track.stop());
  //   localStreamRef.current = null;
  //   remoteStreamRef.current = null;
    
  //   // Reset state
  //   setIsCallActive(false);
  //   setIncomingCall(null);
  //   setOtherUserName('');
    
  //   console.log("✅ Call ended");
  // };

  const handleAcceptCall = async () => {
    if (!incomingCall || !socketRef.current) return;

    try {
      console.log("✅ Call accepted, setting up audio connection...");

      // Create peer connection
      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Handle incoming tracks (caller's audio)
      peerConnectionRef.current.ontrack = (event) => {
        console.log("🎥 Received remote audio track");
        remoteStreamRef.current = event.streams[0];
        
        // Play audio automatically
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.error("Error playing audio:", e));
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current!.emit('ice-candidate', { 
            candidate: event.candidate, 
            target: incomingCall.senderId 
          });
        }
      };

      // Monitor connection state
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log("🔄 Connection state:", peerConnectionRef.current?.connectionState);
        if (peerConnectionRef.current?.connectionState === 'connected') {
          setIsCallActive(true);
        }
      };

      // Get audio only (microphone)
      console.log("🎤 Requesting audio...");
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      console.log("✅ Got audio stream");

      // Add audio track
      audioStream.getAudioTracks().forEach(track => {
        console.log("➕ Adding audio track:", track.label);
        peerConnectionRef.current!.addTrack(track, audioStream);
      });

      localStreamRef.current = audioStream;

      // Set remote description (the offer)
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      // Create and send answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socketRef.current.emit('answer', { 
        answer, 
        target: incomingCall.senderId 
      });
      console.log("📤 Sent answer to:", incomingCall.senderId);

      setOtherUserName(incomingCall.callerName || 'Support Team');
      
    } catch (error) {
      console.error("❌ Error accepting call:", error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIncomingCall(null);
    }
  };

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

    socket.on("offer", async (message: { offer: RTCSessionDescriptionInit, sender: string }) => {
      console.log("📞 Incoming call from:", message.sender);
      
      setIncomingCall({
        senderId: message.sender,
        offer: message.offer,
        callerName: "Support Team"
      });
    });

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

    socket.on("call-rejected", () => {
      console.log("❌ Call was rejected by user");
      alert("The user rejected your call");
      endCall();
    });

    socket.on("call-ended", () => {
      console.log("📞 Call ended by other user");
      endCall();
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
      endCall();
      
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const handleCallConnected = (event: CustomEvent) => {
      console.log('✅ Call connected event received from caller');
      setIsCallActive(true);
      setOtherUserName(event.detail.userName || 'User');
      setOtherUserRoom(event.detail.targetRoom || '');  // ✅ Store target room
    };

    window.addEventListener('call-connected', handleCallConnected as EventListener);

    return () => {
      window.removeEventListener('call-connected', handleCallConnected as EventListener);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socketRef, 
      reconnect, 
      peerConnectionRef,
      localStreamRef,
      remoteStreamRef,
      isCallActive,
      endCall
    }}>
      {children}
      <IncomingCallModal 
        callerInfo={incomingCall}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
      {isCallActive && (
        <ActiveAudioCall 
          callerName={otherUserName}
          onEndCall={endCall}
        />
      )}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  return context;
};