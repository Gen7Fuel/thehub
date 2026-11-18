require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('node:http');
const mongoose = require('mongoose');
const morgan = require('morgan');
const requestId = require('./middleware/requestId');

function getPort(env = process.env) {
  const port = Number(env.PORT || 5005);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return port;
}

function createApp(options = {}) {
  const connection = options.connection || mongoose.connection;
  const state = options.state || { stopping: false };
  const authRoutes = options.routes || require('./routes/auth');
  const authAccessLogger = options.authAccessLogger || require('./middleware/authAccessLogger');
  const app = express();
  // A future Azure cutover must verify the complete proxy chain before
  // changing the existing private/loopback proxy trust policy.
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(requestId());
  app.use(authAccessLogger());
  app.get('/login-auth/health', (req, res) => {
    const ready = !state.stopping && connection.readyState === 1;
    res.status(ready ? 200 : 503).send(ready ? 'OK' : 'Not ready');
  });
  app.use('/login-auth', authRoutes);
  app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.url, method: req.method }));
  return app;
}

async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('MONGO_URI and JWT_SECRET are required');
  const port = getPort();
  await require('./config/db')();
  const state = { stopping: false };
  const server = http.createServer(createApp({ state }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  console.log('[auth] Listening on port', port);
  async function shutdown() {
    if (state.stopping) return;
    state.stopping = true;
    const timer = setTimeout(() => server.closeAllConnections(), 30000);
    timer.unref();
    try {
      await new Promise(resolve => server.close(resolve));
      await mongoose.disconnect();
    } finally { clearTimeout(timer); }
  }
  const stop = () => shutdown().catch(error => {
    console.error('[auth] Shutdown failed', error.code || error.name);
    process.exitCode = 1;
  });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return server;
}

if (require.main === module) start().catch(error => {
  console.error('[auth] Startup failed', error.code || error.name);
  process.exit(1);
});
module.exports = { createApp, start, getPort };
