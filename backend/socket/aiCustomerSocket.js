const { GoogleGenAI, Modality } = require('@google/genai');
const { SCENARIOS } = require('../routes/aiCustomerRoutes');

// Map of socketId -> Gemini Live session
const sessions = new Map();

function setupAiCustomerSocket(io, socket) {
  socket.on('ai-customer:start', async ({ scenarioId }) => {
    // Close any existing session for this socket
    const existing = sessions.get(socket.id);
    if (existing) {
      try { existing.close(); } catch (_) {}
      sessions.delete(socket.id);
    }

    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      socket.emit('ai-customer:error', { message: 'Scenario not found.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-latest',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: scenario.voice || 'Zephyr' },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log(`🎙️ Gemini session opened for socket ${socket.id}`);
            socket.emit('ai-customer:ready');
          },
          onmessage: (message) => {
            try {
              // User speech transcript (what staff said)
              if (message.serverContent?.inputTranscription?.text) {
                socket.emit('ai-customer:user-transcript', {
                  text: message.serverContent.inputTranscription.text,
                });
              }
              // AI speech transcript (what the customer said)
              if (message.serverContent?.outputTranscription?.text) {
                socket.emit('ai-customer:transcript', {
                  text: message.serverContent.outputTranscription.text,
                });
              }
              // Audio chunks
              if (message.serverContent?.modelTurn?.parts) {
                message.serverContent.modelTurn.parts.forEach((part) => {
                  if (part.inlineData?.data) {
                    socket.emit('ai-customer:audio', { data: part.inlineData.data });
                  }
                });
              }
            } catch (err) {
              console.error('onmessage handler error:', err);
            }
          },
          onerror: (e) => {
            console.error(`Gemini session error for ${socket.id}:`, e?.message || e?.code || e);
            socket.emit('ai-customer:error', { message: 'Voice session error.' });
          },
          onclose: (e) => {
            console.log(`🎙️ Gemini session closed for ${socket.id}: code=${e?.code} reason=${e?.reason}`);
            sessions.delete(socket.id);
          },
        },
      });

      sessions.set(socket.id, session);

      // Inject the character persona as the first turn so Gemini stays in character
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: scenario.systemPrompt }] }],
        turnComplete: true,
      });
    } catch (err) {
      console.error('Failed to start Gemini session:', err);
      socket.emit('ai-customer:error', { message: 'Failed to start voice session.' });
    }
  });

  socket.on('ai-customer:audio', async ({ audioData }) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    try {
      await session.sendRealtimeInput({
        media: { data: audioData, mimeType: 'audio/pcm;rate=16000' },
      });
    } catch (err) {
      console.error('Error sending audio to Gemini:', err);
    }
  });

  socket.on('ai-customer:stop', () => {
    const session = sessions.get(socket.id);
    if (session) {
      try { session.close(); } catch (_) {}
      sessions.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id);
    if (session) {
      try { session.close(); } catch (_) {}
      sessions.delete(socket.id);
    }
  });
}

module.exports = setupAiCustomerSocket;
