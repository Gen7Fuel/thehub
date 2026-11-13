const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuid } = require('uuid');
const path = require('node:path');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { createStorage, validFilename, CONTROL_FILE } = require('./storage');

function createApp({ env = process.env, storage = createStorage({ env }) } = {}) {
  const app = express();
  let activeWrites = 0;
  app.locals.drainWrites = async () => { while (activeWrites) await delay(50); };
  let changingPause = false;
  const controlPath = path.join(storage.uploadsDir, CONTROL_FILE);
  function pauseState() {
    try {
      const state = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
      if (typeof state.paused !== 'boolean' || typeof state.drained !== 'boolean') throw new Error('Invalid maintenance state');
      return state;
    }
    catch (err) { if (err.code === 'ENOENT') return { paused: false, drained: false }; throw err; }
  }
  function setPause(state) {
    const temp = controlPath + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(state));
    fs.renameSync(temp, controlPath);
  }
  if (pauseState().paused) setPause({ paused: true, drained: true });
  const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  function admin(req, res, next) {
    if (!env.CDN_ADMIN_TOKEN) return res.status(503).json({ error: 'Admin token not configured on server' });
    if (req.get('Authorization') !== `Bearer ${env.CDN_ADMIN_TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }
  const write = fn => route(async (req, res) => {
    if (pauseState().paused) {
      return res.status(503).set('Retry-After', '60').json({ error: 'File uploads and deletions are paused for maintenance. Please retry shortly.' });
    }
    activeWrites++;
    try { await fn(req, res); } finally { activeWrites--; }
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('file');
  const multipart = (req, res) => new Promise((resolve, reject) => upload(req, res, err => err ? reject(err) : resolve()));
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.get('/cdn', (req, res) => res.send('Upload service running'));
  app.get('/cdn/maintenance', admin, route(async (req, res) => {
    res.json({ ...pauseState(), activeWrites, storage: storage.mode });
  }));
  app.post('/cdn/maintenance', admin, route(async (req, res) => {
    if (typeof req.body?.paused !== 'boolean') return res.status(400).json({ error: 'paused must be a boolean' });
    if (changingPause) return res.status(409).json({ error: 'Maintenance transition already in progress' });
    changingPause = true;
    try {
      setPause({ paused: req.body.paused, drained: false });
      if (req.body.paused) {
        const deadline = Date.now() + 30000;
        while (activeWrites && Date.now() < deadline) await delay(50);
        if (activeWrites) return res.status(409).json({ error: 'Writes are paused but still draining. Retry pause before migration.', activeWrites });
        setPause({ paused: true, drained: true });
      }
      res.json({ ...pauseState(), activeWrites, storage: storage.mode });
    } finally { changingPause = false; }
  }));
  app.post('/cdn/upload', write(async (req, res) => {
    await multipart(req, res);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = uuid() + path.extname(req.file.originalname);
    await storage.put(filename, req.file.buffer);
    res.json({ filename });
  }));
  app.post('/cdn/upload-base64', write(async (req, res) => {
    const { base64Data, fileName } = req.body;
    if (typeof base64Data !== 'string' || !base64Data || typeof fileName !== 'string' || !fileName) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const filename = uuid() + path.extname(fileName);
    await storage.put(filename, Buffer.from(base64Data.split(';base64,').pop(), 'base64'));
    res.json({ filename });
  }));
  app.post('/cdn/upload-png', write(async (req, res) => {
    await multipart(req, res);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const buffer = await sharp(req.file.buffer).png().toBuffer();
    const filename = `${uuid()}.png`;
    await storage.put(filename, buffer);
    res.json({ filename });
  }));
  app.get('/cdn/files', admin, route(async (req, res) => {
    const files = await storage.list();
    files.sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified) || a.filename.localeCompare(b.filename));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const totalPages = Math.ceil(files.length / 100);
    if (page > totalPages && totalPages > 0) return res.status(404).json({ error: `Invalid page number. Maximum page is ${totalPages}` });
    res.json({ files: files.slice((page - 1) * 100, page * 100), totalFiles: files.length, totalPages, currentPage: page });
  }));
  app.delete('/cdn/delete/:id', admin, write(async (req, res) => {
    if (!validFilename(req.params.id)) return res.status(400).json({ error: 'Invalid filename' });
    await storage.remove(req.params.id);
    res.json({ deleted: req.params.id });
  }));
  app.get('/cdn/download/:id', route(async (req, res) => {
    if (!validFilename(req.params.id)) return res.status(400).json({ error: 'Invalid filename' });
    await storage.send(req.params.id, req, res);
  }));
  app.use((err, req, res, next) => {
    if (res.headersSent) { res.destroy(); return; }
    if (err.status === 416) {
      res.removeHeader('Content-Length');
      return res.status(416).end();
    }
    for (const header of ['Content-Length', 'Content-Range', 'Content-Type', 'ETag', 'Last-Modified']) res.removeHeader(header);
    if (err.code === 'ENOENT' || err.statusCode === 404 || err.status === 404) return res.status(404).json({ error: 'File not found' });
    if (err.code === 'LIMIT_FILE_SIZE' || err.status === 413) return res.status(413).json({ error: 'File or request exceeds 50 MB limit' });
    if (err.status === 400 || err instanceof multer.MulterError) return res.status(400).json({ error: 'Invalid upload request' });
    console.error('CDN operation failed:', err.code || err.name);
    res.status(503).set('Retry-After', '60').json({ error: 'File storage temporarily unavailable. Please retry.' });
  });
  return app;
}
module.exports = { createApp };
