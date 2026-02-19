const express = require('express');
const router = express.Router();

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const CLIENT_ID = process.env.INTACCT_CLIENT_ID;
const CLIENT_SECRET = process.env.INTACCT_CLIENT_SECRET;
const CALLBACK_URL = process.env.INTACCT_CALLBACK_URL;

function validateEnvVars() {
  const missing = [];
  if (!CLIENT_ID) missing.push('INTACCT_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('INTACCT_CLIENT_SECRET');
  if (!CALLBACK_URL) missing.push('INTACCT_CALLBACK_URL');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// POST /api/sage/token
router.post('/token', async (req, res) => {
  try {
    validateEnvVars();
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid code' });
    }

    const tokenUrl = 'https://api.intacct.com/ia/api/v1/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', CALLBACK_URL);
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });

    const data = await tokenResp.json();

    if (!tokenResp.ok) {
      // Forward Intacct's error for transparency
      return res.status(tokenResp.status).json({ error: data });
    }

    return res.json(data);
  } catch (err) {
    // Defensive: never leak stack traces
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

module.exports = router;
