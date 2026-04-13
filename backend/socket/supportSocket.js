const SupportTicket = require('../models/Support');
const SupportChat = require('../models/SupportChat');
const { chatTimeoutQueue } = require('../queues/supportChatQueue');

const setupSupportSocket = (io) => {
  // Create support namespace
  const supportNamespace = io.of('/support');

  // Apply auth to support namespace
  const { authSocket } = require('../middleware/authMiddleware');
  supportNamespace.use(authSocket);

  supportNamespace.on('connection', (socket) => {
    console.log(`Support user connected: ${socket.user?.name} (${socket.user?.email})`);

    const isSupport = socket.user?.isSupport === true || socket.user?.is_admin === true;

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

    // ── Support Chat events ────────────────────────────────────────────────

    // Accept a pending chat (Desk only)
    socket.on('support-chat:accept', async ({ chatId }) => {
      try {
        if (!isSupport) {
          socket.emit('support-chat:error', { message: 'Only support users can accept chats.' });
          return;
        }

        // Atomic: only succeeds if still pending
        const chat = await SupportChat.findOneAndUpdate(
          { _id: chatId, status: 'pending' },
          {
            status: 'accepted',
            acceptedBy: {
              id: socket.user._id || socket.user.id,
              name: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
            },
          },
          { new: true }
        );

        if (!chat) {
          socket.emit('support-chat:error', { message: 'Chat already accepted or expired.' });
          return;
        }

        // Cancel the timeout job
        try {
          const job = await chatTimeoutQueue.getJob(chatId);
          if (job) await job.remove();
        } catch (e) {
          console.warn('Could not cancel timeout job:', e?.message);
        }

        // Join this support user to the chat room
        socket.join(`chat-${chatId}`);

        const payload = {
          chatId,
          acceptedBy: chat.acceptedBy,
        };

        // Notify the customer
        supportNamespace.to(`user-${chat.customer.id}`).emit('support-chat:accepted', payload);
        // Notify all support staff (so they remove it from their pending list)
        supportNamespace.to('support-staff').emit('support-chat:accepted', payload);

        console.log(`Chat ${chatId} accepted by ${chat.acceptedBy.name}`);
      } catch (error) {
        console.error('support-chat:accept error:', error);
        socket.emit('support-chat:error', { message: 'Failed to accept chat.' });
      }
    });

    // Join a chat room (customer or accepted support user)
    socket.on('support-chat:join', ({ chatId }) => {
      socket.join(`chat-${chatId}`);
      console.log(`${socket.user?.firstName || socket.id} joined chat room: chat-${chatId}`);
    });

    // Send a message in an accepted chat
    socket.on('support-chat:message', async ({ chatId, text }) => {
      try {
        if (!text || !String(text).trim()) {
          socket.emit('support-chat:error', { message: 'Message text is required.' });
          return;
        }

        const chat = await SupportChat.findById(chatId);
        if (!chat || chat.status !== 'accepted') {
          socket.emit('support-chat:error', { message: 'Chat not active.' });
          return;
        }

        const userId = String(socket.user._id || socket.user.id);
        const isCustomer = userId === String(chat.customer.id);
        const isAcceptedAgent = userId === String(chat.acceptedBy?.id);

        if (!isCustomer && !isAcceptedAgent) {
          socket.emit('support-chat:error', { message: 'You are not a participant in this chat.' });
          return;
        }

        const msg = {
          sender: String(socket.user._id || socket.user.id),
          senderName: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
          senderType: isSupport ? 'agent' : 'customer',
          text: String(text).trim(),
          createdAt: new Date(),
        };

        chat.messages.push(msg);
        await chat.save();

        supportNamespace.to(`chat-${chatId}`).emit('support-chat:new-message', {
          chatId,
          message: msg,
        });
      } catch (error) {
        console.error('support-chat:message error:', error);
        socket.emit('support-chat:error', { message: 'Failed to send message.' });
      }
    });

    // Close a chat
    socket.on('support-chat:close', async ({ chatId }) => {
      try {
        const chat = await SupportChat.findById(chatId);
        if (!chat) {
          socket.emit('support-chat:error', { message: 'Chat not found.' });
          return;
        }

        const userId = String(socket.user._id || socket.user.id);
        const isCustomer = userId === String(chat.customer.id);
        const isAcceptedAgent = userId === String(chat.acceptedBy?.id);

        if (!isCustomer && !isAcceptedAgent && !socket.user?.is_admin) {
          socket.emit('support-chat:error', { message: 'Not allowed to close this chat.' });
          return;
        }

        chat.status = 'closed';
        await chat.save();

        supportNamespace.to(`chat-${chatId}`).emit('support-chat:closed', { chatId });
        console.log(`Chat ${chatId} closed by ${socket.user?.firstName}`);
      } catch (error) {
        console.error('support-chat:close error:', error);
        socket.emit('support-chat:error', { message: 'Failed to close chat.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Support user disconnected: ${socket.user?.name}`);
    });
  });
};

module.exports = setupSupportSocket;