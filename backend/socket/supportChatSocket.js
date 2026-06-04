const SupportChat = require('../models/SupportChat');
const { chatTimeoutQueue } = require('../queues/supportChatQueue');

function setupSupportChatSocket(socket, namespace, isSupport) {
  socket.on('support-chat:accept', async ({ chatId }) => {
    try {
      if (!isSupport) {
        socket.emit('support-chat:error', { message: 'Only support users can accept chats.' });
        return;
      }

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

      try {
        const job = await chatTimeoutQueue.getJob(chatId);
        if (job) await job.remove();
      } catch (e) {
        console.warn('Could not cancel timeout job:', e?.message);
      }

      socket.join(`chat-${chatId}`);

      const payload = { chatId, acceptedBy: chat.acceptedBy };
      namespace.to(`user-${chat.customer.id}`).emit('support-chat:accepted', payload);
      namespace.to('support-staff').emit('support-chat:accepted', payload);
    } catch (error) {
      console.error('support-chat:accept error:', error);
      socket.emit('support-chat:error', { message: 'Failed to accept chat.' });
    }
  });

  socket.on('support-chat:join', ({ chatId }) => {
    socket.join(`chat-${chatId}`);
  });

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

      namespace.to(`chat-${chatId}`).emit('support-chat:new-message', { chatId, message: msg });
    } catch (error) {
      console.error('support-chat:message error:', error);
      socket.emit('support-chat:error', { message: 'Failed to send message.' });
    }
  });

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

      namespace.to(`chat-${chatId}`).emit('support-chat:closed', { chatId });
    } catch (error) {
      console.error('support-chat:close error:', error);
      socket.emit('support-chat:error', { message: 'Failed to close chat.' });
    }
  });
}

module.exports = setupSupportChatSocket;
