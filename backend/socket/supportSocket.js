const SupportTicket = require('../models/Support');

const setupSupportSocket = (io) => {
  // Create support namespace
  const supportNamespace = io.of('/support');

  // Apply auth to support namespace
  const { authSocket } = require('../middleware/authMiddleware');
  supportNamespace.use(authSocket);

  supportNamespace.on('connection', (socket) => {
    console.log(`Support user connected: ${socket.user?.name} (${socket.user?.email})`);

    const supportEmail = 'mohammad@gen7fuel.com' || 'daksh@gen7fuel.com' || 'b@z.com';
    const isSupport = socket.user?.email === supportEmail;

    // Support staff joins support-staff room, users join their own room
    if (isSupport) {
      socket.join('support-staff');
      console.log('Support staff joined support-staff room');
    } else {
      socket.join(`user-${socket.user.id}`);
      console.log(`User ${socket.user?.name} joined room: user-${socket.user.id}`);
    }

    // Join a ticket/conversation room for real-time updates
    socket.on('join-room', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.user?.id} joined room: ${conversationId}`);
    });

    // Handle sending a new message
    socket.on('send-message', async ({ conversationId, text }) => {
      try {
        if (!text || !text.trim()) {
          socket.emit('error', { message: 'Message text is required' });
          return;
        }

        // Find the ticket and check permissions
        const ticket = await SupportTicket.findById(conversationId)
          .populate('userId', 'name email');

        if (!ticket) {
          socket.emit('error', { message: 'Ticket not found' });
          return;
        }

        const isOwner = ticket.userId._id.toString() === socket.user.id;

        if (!isSupport && !isOwner) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Add message to ticket
        const newMessage = {
          sender: socket.user.id,
          text: text.trim(),
          createdAt: new Date()
        };

        ticket.messages.push(newMessage);
        await ticket.save();

        // Populate sender info for the new message
        await ticket.populate('messages.sender', 'name email isSupport');
        const lastMsg = ticket.messages[ticket.messages.length - 1];

        // Emit to all clients in the ticket room with populated sender info
        supportNamespace.to(conversationId).emit('new-message', lastMsg);

        // Optionally, confirm to sender
        socket.emit('message-sent', lastMsg);

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle marking messages as read
    // socket.on('mark-as-read', async ({ conversationId }) => {
    //   try {
    //     const ticket = await SupportTicket.findById(conversationId);

    //     if (!ticket) {
    //       socket.emit('error', { message: 'Ticket not found' });
    //       return;
    //     }

    //     const isOwner = ticket.userId.toString() === socket.user.id;

    //     if (!isSupport && !isOwner) {
    //       socket.emit('error', { message: 'Access denied' });
    //       return;
    //     }

    //     // Mark messages as read
    //     ticket.messages.forEach(message => {
    //       if (message.sender.toString() !== socket.user.id && !message.isRead) {
    //         message.isRead = true;
    //       }
    //     });

    //     await ticket.save();

    //     // Notify other participants
    //     supportNamespace.to(conversationId).emit('messages-read', { conversationId });

    //   } catch (error) {
    //     console.error('Error marking as read:', error);
    //     socket.emit('error', { message: 'Failed to mark as read' });
    //   }
    // });

    // Handle typing indicator
    // socket.on('typing', ({ conversationId, isTyping }) => {
    //   supportNamespace.to(conversationId).emit('user-typing', {
    //     conversationId,
    //     isTyping,
    //     userType: isSupport ? 'support' : 'user',
    //     userName: socket.user?.name
    //   });
    // });

    socket.on('disconnect', () => {
      console.log(`Support user disconnected: ${socket.user?.name}`);
    });
  });
};

module.exports = setupSupportSocket;