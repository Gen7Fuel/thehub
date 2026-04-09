const { Queue, Worker } = require('bullmq');
const connection = require('../utils/redisClient');
const SupportChat = require('../models/SupportChat');
const SupportTicket = require('../models/Support');
const { emailQueue } = require('./emailQueue');

// Module-level io reference, set via initChatQueueIo() after server starts.
let _io = null;

function initChatQueueIo(io) {
  _io = io;
}

const chatTimeoutQueue = new Queue('chatTimeoutQueue', { connection });

const chatTimeoutWorker = new Worker(
  'chatTimeoutQueue',
  async (job) => {
    const { chatId } = job.data;
    console.log(`⏰ Chat timeout fired for ${chatId}`);

    const chat = await SupportChat.findById(chatId);
    if (!chat) {
      console.warn(`Chat ${chatId} not found, skipping timeout.`);
      return;
    }

    if (chat.status !== 'pending') {
      console.log(`Chat ${chatId} is already ${chat.status}, skipping timeout.`);
      return;
    }

    // 1. Mark as expired
    chat.status = 'expired';

    // 2. Create a SupportTicket from the initial message
    const ticket = await SupportTicket.create({
      userId: chat.customer.id,
      text: chat.initialMessage,
      priority: 'medium',
      site: chat.site,
      status: 'open',
      messages: [
        {
          sender: chat.customer.id,
          text: chat.initialMessage,
          createdAt: chat.createdAt,
        },
      ],
    });

    chat.convertedTicketId = ticket._id;
    await chat.save();

    console.log(`Chat ${chatId} expired → ticket ${ticket._id} created`);

    // 3. Notify the customer via socket
    if (_io) {
      const supportNamespace = _io.of('/support');
      supportNamespace
        .to(`user-${chat.customer.id}`)
        .emit('support-chat:expired', {
          chatId,
          ticketId: String(ticket._id),
        });
    }

    // 4. Email the customer with the ticket number
    if (chat.customer.email) {
      try {
        await emailQueue.add('sendChatExpiredEmail', {
          to: chat.customer.email,
          subject: `Support Ticket #${ticket._id} Created`,
          text:
            `Hi ${chat.customer.name || ''},\n\n` +
            `We weren't able to connect you with a support agent right away. ` +
            `A support ticket has been created from your message:\n\n` +
            `"${chat.initialMessage}"\n\n` +
            `Ticket ID: ${ticket._id}\n\n` +
            `Our team will follow up as soon as possible.\n\n` +
            `— Gen7 Fuel Support`,
          html:
            `<p>Hi ${chat.customer.name || ''},</p>` +
            `<p>We weren't able to connect you with a support agent right away. ` +
            `A support ticket has been created from your message:</p>` +
            `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">${chat.initialMessage}</blockquote>` +
            `<p><strong>Ticket ID:</strong> ${ticket._id}</p>` +
            `<p>Our team will follow up as soon as possible.</p>` +
            `<p>— Gen7 Fuel Support</p>`,
        });
      } catch (emailErr) {
        console.error('Failed to queue chat-expired email:', emailErr);
      }
    }
  },
  { connection }
);

chatTimeoutWorker.on('failed', (job, err) => {
  console.error(`Chat timeout job ${job?.id || 'unknown'} failed:`, err.message);
});

chatTimeoutWorker.on('completed', (job) => {
  console.log(`Chat timeout job ${job.id} completed`);
});

module.exports = { chatTimeoutQueue, initChatQueueIo };
