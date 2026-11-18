// Runs only in the disposable internal-network auth rehearsal.
const assert = require('node:assert/strict');
assert.equal(process.env.MONGO_URI, 'mongodb://mongo:27017/auth_fixture');
const mongoose = require('/app/node_modules/mongoose');
const jwt = require('/app/node_modules/jsonwebtoken');
const bcrypt = require('/app/node_modules/bcryptjs');
const User = require('/app/models/User');
const Role = require('/app/models/Role');
const Permission = require('/app/models/Permission');
const Location = require('/app/models/Location');
const Maintenance = require('/app/models/Maintenance');
const AccessLog = require('/app/models/AccessLog');
const ChangeLog = require('/app/models/ChangeLog');
let requestNumber = 0;
async function request(route, body, expected = 200, token) {
  const response = await fetch('http://auth:8080/login-auth/' + route, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'auth-fixture-' + ++requestNumber,
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, expected, route + ' returned unexpected status');
  return response.json();
}
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const roleId = new mongoose.Types.ObjectId();
  // Auth reads these schemas; direct fixture inserts avoid exercising unrelated
  // administrative Role/Permission creation hooks from the main API.
  await Role.collection.insertOne({ _id: roleId, role_name: 'Fixture', inStoreAccount: true,
    permissionsArray: [{ permId: 100, value: true }, { permId: 101, value: false }] });
  await Permission.collection.insertOne({ module_name: 'settings', module_permId: 100,
    structure: [{ name: 'maintenance', permId: 101, children: [] }] });
  await Location.collection.insertOne({ stationName: 'Fixture', type: 'store', timezone: 'America/Toronto' });
  const user = await User.create({ email: 'fixture@example.invalid', password: 'fixture-password', firstName: 'Fixture', lastName: 'User',
    stationName: 'Fixture', role: roleId, site_access: { Fixture: true } });
  assert.equal(user.site, 'Fixture');
  const identity = await request('identify', { email: 'FIXTURE@example.invalid' });
  assert.equal(identity.inStoreAccount, true);
  await request('identify', { email: 'absent@example.invalid' }, 404);
  await request('login', { email: user.email, password: 'incorrect' }, 400);
  const login = await request('login', { email: 'FIXTURE@example.invalid', password: 'fixture-password' });
  const payload = jwt.verify(login.token, process.env.JWT_SECRET);
  assert.equal(payload.id, user.id); assert.equal(payload.timezone, 'America/Toronto');
  assert.equal(payload.permissions[0].children[0].value, false);
  assert.ok(payload.exp > Date.now() / 1000);
  assert.equal((await User.findById(user.id)).is_loggedIn, true);
  await request('refresh-token', { userId: user.id }, 401);
  await request('refresh-token', { userId: user.id }, 401, 'invalid');
  await request('refresh-token', { userId: user.id }, 401, jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -1 }));
  await request('refresh-token', { userId: new mongoose.Types.ObjectId().toString() }, 403, login.token);
  const refreshed = await request('refresh-token', { userId: user.id }, 200, login.token);
  assert.equal(jwt.verify(refreshed.token, process.env.JWT_SECRET).id, user.id);
  assert.equal((await request('maintenance-status')).active, false);
  await Maintenance.collection.insertOne({ status: 'ongoing', scheduleClose: new Date(Date.now() + 3600000) });
  await request('login', { email: user.email, password: 'fixture-password' }, 503);
  await request('refresh-token', { userId: user.id }, 503, login.token);
  await request('register', { email: 'blocked@example.invalid' }, 503);
  await Role.collection.updateOne({ _id: roleId }, { $set: { permissionsArray: [{ permId: 100, value: true }, { permId: 101, value: true }] } });
  await request('login', { email: user.email, password: 'fixture-password' });
  await request('refresh-token', { userId: user.id }, 200, login.token);
  await Maintenance.deleteMany({});
  await User.updateOne({ _id: user.id }, { $set: { is_active: false } });
  await request('login', { email: user.email, password: 'fixture-password' }, 403);
  await request('refresh-token', { userId: user.id }, 403, login.token);
  const registered = await request('register', { email: 'New@example.invalid', password: 'new-fixture-password', firstName: 'New', lastName: 'Fixture', stationName: 'Fixture' }, 201);
  assert.equal(registered.user.email, 'new@example.invalid');
  assert.equal(registered.user.password, undefined);
  const newUser = await User.findOne({ email: 'new@example.invalid' });
  assert.equal(await bcrypt.compare('new-fixture-password', newUser.password), true);
  for (let i = 0; i < 50 && await AccessLog.countDocuments({ requestId: /^auth-fixture-/ }) < requestNumber - 1; i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(await AccessLog.countDocuments({ statusCode: 400 }) > 0);
  assert.ok(await ChangeLog.countDocuments({ resourceId: user._id, action: 'update' }) > 0);
  console.log('PASS: standalone auth login/JWT, refresh, inactive account, maintenance denial/bypass, registration, shared models, and audit persistence');
}
main().then(() => mongoose.disconnect()).catch(error => { console.error(error); process.exitCode = 1; mongoose.disconnect(); });
