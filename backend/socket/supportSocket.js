const SupportConversation = require('../models/Support');

const setupSupportSocket = (io) => {
  // Create support namespace
  const supportNamespace = io.of('/support');

  // Apply auth to support namespace
  const { authSocket } = require('../middleware/authMiddleware');
  supportNamespace.use(authSocket);

  // Support chat handlers
  supportNamespace.on('connection', (socket) => {
    console.log(`Support user connected: ${socket.user.name} (${socket.user.email})`);
    
    const supportEmail = 'mohammad@gen7fuel.com';
    const isSupport = socket.user.email === supportEmail;
    
    if (isSupport) {
      // Support staff joins all conversation rooms
      socket.join('support-staff');
      console.log('Support staff joined support-staff room');
    } else {
      // Regular users join their own conversation room
      socket.join(`user-${socket.user.id}`);
      console.log(`User ${socket.user.name} joined room: user-${socket.user.id}`);
    }

    // Handle new message
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, text } = data;
        
        if (!text || !text.trim()) {
          socket.emit('error', { message: 'Message text is required' });
          return;
        }

        // Find conversation and verify permissions
        const conversation = await SupportConversation.findById(conversationId)
          .populate('userId', 'name email');
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const isOwner = conversation.userId._id.toString() === socket.user.id;
        
        if (!isSupport && !isOwner) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Add message to conversation
        const newMessage = {
          senderId: socket.user.id,
          text: text.trim(),
          isRead: false
        };

        conversation.messages.push(newMessage);
        await conversation.save();

        // Get the populated conversation
        const updatedConversation = await SupportConversation.findById(conversationId)
          .populate('userId', 'name email')
          .populate('messages.senderId', 'name email');

        const messageData = {
          conversationId,
          message: updatedConversation.messages[updatedConversation.messages.length - 1],
          conversation: updatedConversation
        };

        if (isSupport) {
          // Support sent message - notify the user and update support staff
          socket.to(`user-${conversation.userId._id}`).emit('new-message', messageData);
          socket.to('support-staff').emit('conversation-updated', updatedConversation);
          socket.emit('message-sent', messageData);
        } else {
          // User sent message - notify support staff
          socket.to('support-staff').emit('new-message', messageData);
          socket.to('support-staff').emit('conversation-updated', updatedConversation);
          socket.emit('message-sent', messageData);
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle marking messages as read
    socket.on('mark-as-read', async (data) => {
      try {
        const { conversationId } = data;
        
        const conversation = await SupportConversation.findById(conversationId);
        
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const isOwner = conversation.userId.toString() === socket.user.id;
        
        if (!isSupport && !isOwner) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Mark messages as read
        conversation.messages.forEach(message => {
          if (message.senderId.toString() !== socket.user.id && !message.isRead) {
            message.isRead = true;
          }
        });

        await conversation.save();

        // Notify other participants
        if (isSupport) {
          socket.to(`user-${conversation.userId}`).emit('messages-read', { conversationId });
        } else {
          socket.to('support-staff').emit('messages-read', { conversationId });
        }

      } catch (error) {
        console.error('Error marking as read:', error);
        socket.emit('error', { message: 'Failed to mark as read' });
      }
    });

    // Handle user typing
    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      
      if (isSupport) {
        socket.to(`user-${conversationId}`).emit('user-typing', {
          conversationId,
          isTyping,
          userType: 'support'
        });
      } else {
        socket.to('support-staff').emit('user-typing', {
          conversationId,
          isTyping,
          userType: 'user',
          userName: socket.user.name
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Support user disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = setupSupportSocket;