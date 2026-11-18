const CHANNEL = 'gen7hub:runtime:socket:v1';
const EVENTS = new Set(['new-notification', 'retail-price-published']);
const pending = new Set();

function createPublisher(redis, rooms = []) {
  return {
    to(room) { return createPublisher(redis, [...rooms, ...[room].flat().map(String)]); },
    emit(event, ...args) {
      if (!EVENTS.has(event)) throw new Error('Unsupported background socket event');
      const body = JSON.stringify({ version: 1, event, rooms, args });
      if (Buffer.byteLength(body) > 512 * 1024) throw new Error('Background socket event exceeds limit');
      const operation = redis.publish(CHANNEL, body).catch(error => {
        console.error('[socket-bridge] Publish failed', error.code || error.name);
      }).finally(() => pending.delete(operation));
      pending.add(operation);
      return true;
    },
  };
}
async function subscribe(io, redis) {
  const subscriber = redis.duplicate();
  let ready = false;
  subscriber.on('error', error => console.error('[socket-bridge] Redis error', error.code || error.name));
  subscriber.on('close', () => { ready = false; });
  subscriber.on('ready', () => { ready = true; });
  subscriber.on('message', (channel, body) => {
    if (channel !== CHANNEL || Buffer.byteLength(body) > 512 * 1024) return;
    try {
      const value = JSON.parse(body);
      if (value.version !== 1 || !EVENTS.has(value.event) || !Array.isArray(value.rooms) ||
          value.rooms.some(room => typeof room !== 'string') || !Array.isArray(value.args)) return;
      const target = value.rooms.length ? io.to(value.rooms) : io;
      target.emit(value.event, ...value.args);
    } catch (error) { console.error('[socket-bridge] Invalid event', error.name); }
  });
  await subscriber.subscribe(CHANNEL);
  ready = true;
  return { isReady: () => ready, close: () => subscriber.quit() };
}
async function flush() { await Promise.all([...pending]); }
module.exports = { createPublisher, subscribe, flush, CHANNEL };
