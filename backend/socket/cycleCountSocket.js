function setupCycleCountSocket(io, socket) {
  socket.on("cycle-count-field-updated", ({ itemId, field, value }) => {
    console.log("📡 cycle-count-field-updated", { itemId, field, value });

    // Broadcast to all other connected clients except the sender
    socket.broadcast.emit("cycle-count-field-updated", { itemId, field, value });

    console.log("📡 Broadcast sent to other clients");
  });
}

module.exports = setupCycleCountSocket;
