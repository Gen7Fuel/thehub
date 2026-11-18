require('dotenv').config();
require('./runtime/role').selectRole('scheduler');
require('./runtime/backgroundProcess').start().catch(error => {
  console.error('[scheduler] Startup failed', error.code || error.name); process.exit(1);
});
