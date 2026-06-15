const { authSocket } = require('../middleware/authMiddleware');
const setupTicketSocket = require('./ticketSocket');

const debug = process.env.SOCKET_DEBUG === 'true';

function setupSupportSocket(io) {
  const supportNamespace = io.of('/support');
  supportNamespace.use(authSocket);

  supportNamespace.on('connection', (socket) => {
    if (debug) console.log(`[socket] support connected: ${socket.user?.name} (${socket.user?.email})`);

    const isSupport = socket.user?.isSupport === true || socket.user?.is_admin === true;

    if (isSupport) {
      socket.join('support-staff');
    } else {
      socket.join(`user-${socket.user.id}`);
    }

    // Allow joining a specific ticket or chat room
    socket.on('join-room', (conversationId) => {
      if (conversationId) socket.join(conversationId);
    });

    setupTicketSocket(socket, supportNamespace, isSupport);

    socket.on('disconnect', () => {
      if (debug) console.log(`[socket] support disconnected: ${socket.user?.name}`);
    });
  });
}

module.exports = setupSupportSocket;
