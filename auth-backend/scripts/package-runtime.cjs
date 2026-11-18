const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../..');
const models = ['User', 'Role', 'Permission', 'Location', 'Maintenance', 'AccessLog', 'ChangeLog'];
function packageRuntime(output) {
  const destination = path.resolve(output);
  assert.ok(!fs.existsSync(destination), 'Package destination must be new');
  fs.mkdirSync(destination, { recursive: true });
  function copy(source, relative) {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repo, source), target);
  }
  for (const file of ['app.js', 'package.json', 'package-lock.json']) copy('auth-backend/' + file, file);
  for (const directory of ['config', 'routes', 'middleware', 'utils']) {
    for (const file of fs.readdirSync(path.join(repo, 'auth-backend', directory))) {
      if (file.endsWith('.js')) copy('auth-backend/' + directory + '/' + file, directory + '/' + file);
    }
  }
  for (const model of models) copy('backend/models/' + model + '.js', 'models/' + model + '.js');
  copy('backend/utils/attachSiteAlias.js', 'utils/attachSiteAlias.js');
  return destination;
}
if (require.main === module) {
  assert.ok(process.argv[2], 'Specify a new output directory');
  packageRuntime(process.argv[2]);
  console.log('Auth runtime packaged with shared models; no environment files included');
}
module.exports = { packageRuntime, models };
