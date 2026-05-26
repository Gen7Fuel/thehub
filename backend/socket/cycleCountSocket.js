function setupCycleCountSocket(io, socket) {
  socket.on("cycle-count-field-updated", ({ itemId, field, value }) => {
    console.log("cycle-count-field-updated", { itemId, field, value });

    socket.broadcast.emit("cycle-count-field-updated", { itemId, field, value });

    console.log("cycle-count-field-updated broadcast sent to other clients");
  });

  socket.on("cycle-count-field-updated-v2", ({ entryId, field, value, breakdown, site }) => {
    console.log("cycle-count-field-updated-v2", { entryId, field, value, breakdown, site });

    socket.broadcast.emit("cycle-count-field-updated-v2", {
      entryId,
      field,
      value,
      breakdown,
      site,
    });

    console.log("cycle-count-field-updated-v2 broadcast sent to other clients");
  });
}

module.exports = setupCycleCountSocket;
