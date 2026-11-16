const { spawnSync } = require('node:child_process');
const { BlobServiceClient } = require('../../../../cdn/node_modules/@azure/storage-blob');
async function main() {
  const result = spawnSync('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe', ['-IBm', 'azure.cli',
    'account', 'get-access-token', '--subscription', '29b24248-1990-4592-b25d-e6ee8e9db784',
    '--resource', 'https://storage.azure.com/', '--output', 'json'], { encoding: 'utf8', timeout: 45000 });
  if (result.status !== 0) throw new Error('Azure authentication failed');
  const auth = JSON.parse(result.stdout);
  const client = new BlobServiceClient('https://gen7erpmedia29b24248.blob.core.windows.net', {
    getToken: async () => ({ token: auth.accessToken, expiresOnTimestamp: Number(auth.expires_on) * 1000 }),
  });
  const blob = client.getContainerClient('hub').getBlobClient('_migration/cdn/online-copy-status.json');
  try { console.log((await blob.downloadToBuffer()).toString('utf8')); }
  catch (error) { if (error.statusCode === 404) console.log('{"phase":"not-started"}'); else throw error; }
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });
