const { createApp } = require('./app');
const { runtimeOptions } = require('./runtime');

function startServer(env = process.env) {
  const { port, host } = runtimeOptions(env);
  const app = createApp({ env });
  const server = app.listen(port, host, () => console.log(`Upload service running on port ${server.address().port}`));
  return { app, server };
}

if (require.main === module) {
  const { app, server } = startServer();
  const shutdown = () => server.close(async () => {
    await app.locals.drainWrites();
    process.exit(0);
  });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

module.exports = { startServer };
