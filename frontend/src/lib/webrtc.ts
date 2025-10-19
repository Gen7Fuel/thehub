import { io, Socket } from 'socket.io-client';

export interface WebRTCClient {
  socket: Socket;
  localStream: MediaStream | null;
  peerConnections: Map<string, RTCPeerConnection>;
  joinRoom: (roomId: string, userId: string, userName?: string) => void;
  leaveRoom: () => void;
  startLocalVideo: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  stopLocalVideo: () => void;
  sendChatMessage: (message: string) => void;
  disconnect: () => void;
}

export interface WebRTCEvents {
  'joined-room': (data: { roomId: string; userId: string; participants: any[] }) => void;
  'user-joined': (data: { userId: string; userName: string; socketId: string }) => void;
  'user-left': (data: { userId: string; userName: string; socketId: string }) => void;
  'remote-stream': (data: { stream: MediaStream; userId: string; socketId: string }) => void;
  'chat-message': (data: { userId: string; userName: string; message: string; timestamp: string }) => void;
  'user-typing': (data: { userId: string; userName: string; isTyping: boolean }) => void;
  'error': (data: { message: string }) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createWebRTCClient(events: WebRTCEvents): WebRTCClient {
  const socket = io('/webrtc', {
    path: '/signaling',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  const peerConnections = new Map<string, RTCPeerConnection>();
  let localStream: MediaStream | null = null;
  let currentRoom: string | null = null;

  // Socket event handlers
  socket.on('joined-room', events['joined-room']);
  socket.on('user-joined', handleUserJoined);
  socket.on('user-left', handleUserLeft);
  socket.on('offer', handleOffer);
  socket.on('answer', handleAnswer);
  socket.on('ice-candidate', handleIceCandidate);
  socket.on('chat-message', events['chat-message']);
  socket.on('user-typing', events['user-typing']);
  socket.on('error', events['error']);

  async function handleUserJoined(data: { userId: string; userName: string; socketId: string }) {
    console.log('User joined:', data);
    events['user-joined'](data);
    
    // Create peer connection and send offer
    if (localStream) {
      await createPeerConnection(data.socketId, true);
    }
  }

  function handleUserLeft(data: { userId: string; userName: string; socketId: string }) {
    console.log('User left:', data);
    events['user-left'](data);
    
    // Clean up peer connection
    const pc = peerConnections.get(data.socketId);
    if (pc) {
      pc.close();
      peerConnections.delete(data.socketId);
    }
  }

  async function handleOffer(data: { fromSocketId: string; fromUserId: string; offer: RTCSessionDescriptionInit; roomId: string }) {
    console.log('Received offer from:', data.fromSocketId);
    await createPeerConnection(data.fromSocketId, false);
    
    const pc = peerConnections.get(data.fromSocketId);
    if (pc) {
      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('answer', {
        targetSocketId: data.fromSocketId,
        answer,
        roomId: data.roomId
      });
    }
  }

  async function handleAnswer(data: { fromSocketId: string; fromUserId: string; answer: RTCSessionDescriptionInit; roomId: string }) {
    console.log('Received answer from:', data.fromSocketId);
    const pc = peerConnections.get(data.fromSocketId);
    if (pc) {
      await pc.setRemoteDescription(data.answer);
    }
  }

  async function handleIceCandidate(data: { fromSocketId: string; fromUserId: string; candidate: RTCIceCandidateInit; roomId: string }) {
    console.log('Received ICE candidate from:', data.fromSocketId);
    const pc = peerConnections.get(data.fromSocketId);
    if (pc) {
      await pc.addIceCandidate(data.candidate);
    }
  }

  async function createPeerConnection(socketId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnections.set(socketId, pc);

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote stream from:', socketId);
      events['remote-stream']({
        stream: event.streams[0],
        userId: socketId, // You might want to map this to actual userId
        socketId
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentRoom) {
        socket.emit('ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate,
          roomId: currentRoom
        });
      }
    };

    // Create and send offer if initiator
    if (isInitiator && currentRoom) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('offer', {
        targetSocketId: socketId,
        offer,
        roomId: currentRoom
      });
    }

    return pc;
  }

  return {
    socket,
    localStream,
    peerConnections,

    joinRoom: (roomId: string, userId: string, userName?: string) => {
      currentRoom = roomId;
      socket.emit('join-room', { roomId, userId, userName });
    },

    leaveRoom: () => {
      if (currentRoom) {
        socket.emit('leave-room');
        currentRoom = null;
        
        // Close all peer connections
        peerConnections.forEach(pc => pc.close());
        peerConnections.clear();
      }
    },

    startLocalVideo: async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return localStream;
      } catch (error) {
        console.error('Error accessing media devices:', error);
        throw error;
      }
    },

    stopLocalVideo: () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
    },

    sendChatMessage: (message: string) => {
      if (currentRoom) {
        socket.emit('chat-message', { roomId: currentRoom, message });
      }
    },

    disconnect: () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      peerConnections.forEach(pc => pc.close());
      socket.disconnect();
    }
  };
}