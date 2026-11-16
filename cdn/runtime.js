const fs = require('node:fs');
const path = require('node:path');

function adminTokenReady(env) {
  return typeof env.CDN_ADMIN_TOKEN === 'string' && env.CDN_ADMIN_TOKEN.trim().length > 0 &&
    !/^\s*@Microsoft\.KeyVault\s*\(/i.test(env.CDN_ADMIN_TOKEN);
}

function runtimeOptions(env = process.env) {
  const value = env.PORT ?? '5001';
  if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  if (env.CDN_START_PAUSED !== undefined && !['true', 'false'].includes(env.CDN_START_PAUSED)) {
    throw new Error('CDN_START_PAUSED must be true or false');
  }
  if (env.WEBSITE_INSTANCE_ID) {
    if (env.CDN_STORAGE !== 'azure') throw new Error('App Service requires CDN_STORAGE=azure');
    if (!adminTokenReady(env)) throw new Error('App Service requires a resolved CDN_ADMIN_TOKEN');
    const controlDir = path.posix.resolve('/', env.CDN_UPLOADS_DIR || '');
    if (!path.posix.isAbsolute(env.CDN_UPLOADS_DIR || '') || !controlDir.startsWith('/home/')) {
      throw new Error('App Service requires CDN_UPLOADS_DIR under persistent /home');
    }
  }
  return { port: Number(value), host: '0.0.0.0' };
}

function releaseId() {
  try {
    const release = JSON.parse(fs.readFileSync(path.join(__dirname, 'release.json'), 'utf8'));
    return /^[a-f0-9]{40}$/.test(release.commit) ? release.commit : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

module.exports = { adminTokenReady, runtimeOptions, releaseId };
