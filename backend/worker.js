require('dotenv').config();
require('./runtime/role').selectRole('worker');
require('./runtime/backgroundProcess').start().catch(error => {
  console.error('[worker] Startup failed', error.code || error.name); process.exit(1);
});
