const { Readable } = require('node:stream');
function fakeContainer() {
  const blobs = new Map();
  let sequence = 0;
  const notFound = () => Object.assign(new Error('Not found'), { statusCode: 404 });
  function condition(current, conditions) {
    if (conditions?.ifNoneMatch === '*' && current || conditions?.ifMatch && current?.etag !== conditions.ifMatch) {
      throw Object.assign(new Error('Precondition failed'), { statusCode: 412 });
    }
  }
  return {
    blobs,
    getBlockBlobClient(name) {
      return {
        url: 'https://test.invalid/container/' + name,
        async getProperties() {
          const blob = blobs.get(name);
          if (!blob) throw notFound();
          return { contentLength: blob.data.length, metadata: { ...blob.metadata }, etag: blob.etag,
            lastModified: new Date(), contentType: blob.type };
        },
        async uploadData(data, options = {}) {
          condition(blobs.get(name), options.conditions);
          blobs.set(name, { data: Buffer.from(data), metadata: options.metadata || {},
            etag: `"${++sequence}"`, type: options.blobHTTPHeaders?.blobContentType });
        },
        async uploadFile(filename, options) { return this.uploadData(await require('node:fs/promises').readFile(filename), options); },
        async download(offset = 0, count, options) {
          const blob = blobs.get(name);
          if (!blob) throw notFound();
          condition(blob, options?.conditions);
          return { readableStreamBody: Readable.from(blob.data.subarray(offset, count === undefined ? undefined : offset + count)) };
        },
        async delete(options) {
          if (!blobs.has(name)) throw notFound();
          condition(blobs.get(name), options?.conditions);
          blobs.delete(name);
        },
      };
    },
    async *listBlobsFlat({ prefix }) {
      for (const [name, blob] of blobs) if (name.startsWith(prefix)) yield {
        name, metadata: { ...blob.metadata }, properties: { contentLength: blob.data.length, lastModified: new Date(), etag: blob.etag },
      };
    },
  };
}
module.exports = { fakeContainer };
