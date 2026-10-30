const SupportTicket = require('../models/Support');
const { randomUUID } = require('crypto');
const { logChange } = require('../middleware/changeLogger');

function setupTicketSocket(socket, namespace, isSupport) {
  socket.on('send-message', async ({ conversationId, text }) => {
    try {
      if (!text || !text.trim()) {
        socket.emit('error', { message: 'Message text is required' });
        return;
      }

      const ticket = await SupportTicket.findById(conversationId)
        .populate('userId', 'firstName lastName email');

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

      const before = ticket.toObject();
      ticket.messages.push(newMessage);
      await ticket.save();

      await logChange({
        user: socket.user,
        headers: socket.request?.headers || {},
        socket: { remoteAddress: socket.handshake?.address },
        requestId: randomUUID(),
      }, {
        action: 'update', resourceType: 'support-ticket', resourceId: ticket._id,
        resourceStore: 'mongodb', success: true, statusCode: 200, source: 'support.detail',
        method: 'SOCKET', path: 'support:send-message',
        message: `Reply added to support ticket for ${ticket.site}`,
        before, after: ticket.toObject(),
      });

      await ticket.populate('messages.sender', 'firstName lastName email isSupport');
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
