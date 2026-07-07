// backend/utils/emailHelpers.js

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function attachmentContentToBase64(content) {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  if (content && typeof content.pipe === 'function') {
    return (await streamToBuffer(content)).toString('base64');
  }
  return content;
}

module.exports = {
  attachmentContentToBase64
};