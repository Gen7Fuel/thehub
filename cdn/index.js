const { createApp } = require('./app');
const app = createApp();
const server = app.listen(5001, () => console.log('Upload service running on port 5001'));
process.on('SIGTERM', () => server.close(async () => {
  await app.locals.drainWrites();
  process.exit(0);
}));
