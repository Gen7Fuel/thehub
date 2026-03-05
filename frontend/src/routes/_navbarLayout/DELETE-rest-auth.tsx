import { createFileRoute } from '@tanstack/react-router';

// Use environment variables for credentials
const CLIENT_ID = import.meta.env.VITE_INTACCT_CLIENT_ID || '1710a1e613264e15a4e5.app.sage.com';
const CALLBACK_URL = import.meta.env.VITE_INTACCT_CALLBACK_URL || 'https://app.gen7fuel.com/callback';

const BASE_URL = 'https://api.intacct.com/ia/api/';
const VERSION = 'v1/';
const AUTH_ENDPOINT = 'oauth2/authorize';

function buildAuthUrl() {
  if (!CLIENT_ID || !CALLBACK_URL) return '';
  return (
    BASE_URL +
    VERSION +
    AUTH_ENDPOINT +
    '?state=123456' +
    '&response_type=code' +
    '&client_id=' +
    encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' +
    encodeURIComponent(CALLBACK_URL)
  );
}

export const Route = createFileRoute('/_navbarLayout/rest-auth')({
  component: RestAuthPage,
});

function RestAuthPage() {
  const authUrl = buildAuthUrl();
  return (
    <div>
      <h1>JavaScript REST authorization example</h1>
      {authUrl ? (
        <a href={authUrl}>Authorize application</a>
      ) : (
        <div style={{ color: 'red' }}>
          Missing CLIENT_ID or CALLBACK_URL. Set VITE_INTACCT_CLIENT_ID and VITE_INTACCT_CALLBACK_URL in your environment.
        </div>
      )}
    </div>
  );
}
