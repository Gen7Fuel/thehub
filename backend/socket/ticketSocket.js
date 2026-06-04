const SupportTicket = require('../models/Support');

function setupTicketSocket(socket, namespace, isSupport) {
  socket.on('send-message', async ({ conversationId, text }) => {
    try {
      if (!text || !text.trim()) {
        socket.emit('error', { message: 'Message text is required' });
        return;
      }

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

      const newMessage = {
        sender: socket.user.id,
        text: text.trim(),
        createdAt: new Date(),
      };

      ticket.messages.push(newMessage);
      await ticket.save();

      await ticket.populate('messages.sender', 'name email isSupport');
      const lastMsg = ticket.messages[ticket.messages.length - 1];

      namespace.to(conversationId).emit('new-message', lastMsg);
      socket.emit('message-sent', lastMsg);
    } catch (error) {
      console.error('send-message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
}

module.exports = setupTicketSocket;
