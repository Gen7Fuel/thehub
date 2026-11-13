const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const mime = require('mime-types');

const CONTROL_FILE = '.cdn-maintenance.json';
const PREFIX = 'cdn/';
function isDirectory(blob) {
  return blob.properties?.resourceType === 'directory' || blob.metadata?.hdi_isfolder === 'true';
}
function validFilename(name) {
  return typeof name === 'string' && name.length > 0 && !name.startsWith('.') &&
    !/[\\/\x00-\x1f\x7f]/.test(name) && name === path.basename(name);
}
function contentType(name) { return mime.lookup(name) || 'application/octet-stream'; }
function modified(metadata, fallback) {
  const date = new Date(metadata?.originalmtime || fallback);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid stored modification date');
  return date.toISOString();
}
function azureContainer(env = process.env) {
  if (!env.AZURE_STORAGE_CONNECTION_STRING || !env.AZURE_CONTAINER) {
    throw new Error('Azure storage requires AZURE_STORAGE_CONNECTION_STRING and AZURE_CONTAINER');
  }
  const { BlobServiceClient } = require('@azure/storage-blob');
  return BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(env.AZURE_CONTAINER);
}
function createStorage({ env = process.env, container } = {}) {
  const mode = env.CDN_STORAGE || 'local';
  const uploadsDir = path.resolve(env.CDN_UPLOADS_DIR || path.join(__dirname, 'uploads'));
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!['local', 'azure'].includes(mode)) throw new Error('CDN_STORAGE must be local or azure');
  if (mode === 'azure') container ||= azureContainer(env);
  return {
    mode, uploadsDir,
    async put(filename, buffer) {
      if (!validFilename(filename)) throw new Error('Invalid filename');
      if (mode === 'local') {
        await fs.promises.writeFile(path.join(uploadsDir, filename), buffer, { flag: 'wx' });
      } else {
        await container.getBlockBlobClient(PREFIX + filename).uploadData(buffer, {
          conditions: { ifNoneMatch: '*' },
          blobHTTPHeaders: { blobContentType: contentType(filename) },
          metadata: { originalmtime: new Date().toISOString(),
            sha256: crypto.createHash('sha256').update(buffer).digest('hex') },
        });
      }
    },
    async list() {
      if (mode === 'local') {
        const files = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
        const result = [];
        for (const file of files) {
          if (!file.isFile() || !validFilename(file.name)) continue;
          try {
            const stat = await fs.promises.stat(path.join(uploadsDir, file.name));
            result.push({ filename: file.name, size: stat.size, lastModified: stat.mtime.toISOString() });
          } catch (err) { if (err.code !== 'ENOENT') throw err; }
        }
        return result;
      }
      const result = [];
      for await (const blob of container.listBlobsFlat({ prefix: PREFIX, includeMetadata: true })) {
        if (isDirectory(blob)) continue;
        const filename = blob.name.slice(PREFIX.length);
        if (!validFilename(filename)) continue;
        result.push({ filename, size: blob.properties.contentLength,
          lastModified: modified(blob.metadata, blob.properties.lastModified) });
      }
      return result;
    },
    async remove(filename) {
      if (mode === 'local') await fs.promises.unlink(path.join(uploadsDir, filename));
      else await container.getBlockBlobClient(PREFIX + filename).delete();
    },
    async send(filename, req, res) {
      if (mode === 'local') {
        await new Promise((resolve, reject) => res.sendFile(path.join(uploadsDir, filename),
          err => err ? reject(err) : resolve()));
        return;
      }
      const blob = container.getBlockBlobClient(PREFIX + filename);
      const props = await blob.getProperties();
      const lastModified = new Date(modified(props.metadata, props.lastModified)).toUTCString();
      res.set({ 'Content-Type': props.contentType || contentType(filename),
        'Content-Length': props.contentLength, ETag: props.etag,
        'Last-Modified': lastModified, 'Accept-Ranges': 'bytes' });
      if (req.fresh) { res.status(304).end(); return; }
      let offset = 0;
      let count;
      const ifRange = req.get('If-Range');
      const allowRange = !ifRange || ifRange === props.etag ||
        Date.parse(ifRange) >= Date.parse(lastModified);
      if (req.headers.range && allowRange) {
        const ranges = req.range(props.contentLength);
        if (ranges === -1) {
          res.removeHeader('Content-Length');
          res.status(416).set('Content-Range', `bytes */${props.contentLength}`).end(); return;
        }
        if (Array.isArray(ranges) && ranges.type === 'bytes' && ranges.length === 1) {
          offset = ranges[0].start;
          count = ranges[0].end - offset + 1;
          res.status(206).set({ 'Content-Range': `bytes ${offset}-${ranges[0].end}/${props.contentLength}`,
            'Content-Length': count });
        }
      }
      if (req.method === 'HEAD' || props.contentLength === 0) { res.end(); return; }
      const response = await blob.download(offset, count, { conditions: { ifMatch: props.etag } });
      await pipeline(response.readableStreamBody, res);
    },
  };
}
module.exports = { createStorage, azureContainer, validFilename, contentType, modified, isDirectory, CONTROL_FILE, PREFIX };
