import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const CLIENT_ID = import.meta.env.VITE_INTACT_CLIENT_ID || '1710a1e613264e15a4e5.app.sage.com'
const CLIENT_SECRET = import.meta.env.VITE_INTACT_CLIENT_SECRET || 'd286fcc231372a738634f72e0126753fd0186d24'
const CALLBACK_URL = import.meta.env.VITE_INTACT_CALLBACK_URL || 'https://app.gen7fuel.com/callback'

const BASE_URL = 'https://api.intacct.com/ia/api/'
const VERSION = 'v1/'
const TOKEN_ENDPOINT = 'oauth2/token'
const VENDOR_ENDPOINT = 'objects/accounts-payable/vendor/33'

interface VendorResult {
  key?: string
  id?: string
  name?: string
}

export const Route = createFileRoute('/_navbarLayout/callback')({
  component: CallbackPage,
})

function CallbackPage() {
  const [token, setToken] = useState<string | null>(null)
  const [vendor, setVendor] = useState<VendorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code === null) {
      setError('No authorization code found in URL.');
      return;
    }
    if (!CLIENT_ID || !CLIENT_SECRET || !CALLBACK_URL) {
      setError('Missing required environment variables.');
      return;
    }

    async function fetchTokenAndVendor() {
      try {
        // Exchange code for token
        const tokenUrl = BASE_URL + VERSION + TOKEN_ENDPOINT;
        const inputBody = new URLSearchParams();
        inputBody.append('grant_type', 'authorization_code');
        inputBody.append('code', code!); // code is guaranteed to be string
        inputBody.append('redirect_uri', CALLBACK_URL);
        inputBody.append('client_id', CLIENT_ID);
        inputBody.append('client_secret', CLIENT_SECRET);

        // Debug: log token URL and params
        console.log('Token URL:', tokenUrl);
        console.log('Token request body:', Object.fromEntries(inputBody.entries()));

        const tokenResp = await fetch(tokenUrl, {
          method: 'POST',
          body: inputBody,
        });

        if (!tokenResp.ok) {
          setError(`Token request failed: ${tokenResp.status} ${tokenResp.statusText}`);
          return;
        }

        const tokenData = await tokenResp.json();
        const accessToken =
          tokenData.access_token ||
          new URLSearchParams(tokenData).get('access_token') ||
          null;

        if (!accessToken) {
          setError('No access token found in response.');
          return;
        }
        setToken(accessToken);

        // Fetch vendor data
        const vendorUrl = BASE_URL + VERSION + VENDOR_ENDPOINT;
        // Debug: log vendor URL
        console.log('Vendor URL:', vendorUrl);

        const vendorResp = await fetch(vendorUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!vendorResp.ok) {
          setError(`Vendor request failed: ${vendorResp.status} ${vendorResp.statusText}`);
          return;
        }

        const vendorData = await vendorResp.json();
        const result = vendorData['ia::result'] || {};
        setVendor({
          key: result.key,
          id: result.id,
          name: result.name,
        });
      } catch (err: any) {
        setError('Unexpected error: ' + (err?.message || String(err)));
        // Debug: log full error object
        console.error('Fetch error details:', err);
      }
    }

    fetchTokenAndVendor();
  }, []);

  return (
    <div>
      <h1>REST OAuth Callback</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {vendor && (
        <div>
          <div>Vendor key: {vendor.key ?? 'N/A'}</div>
          <div>Vendor id: {vendor.id ?? 'N/A'}</div>
          <div>Vendor name: {vendor.name ?? 'N/A'}</div>
        </div>
      )}
      {token && (
        <div>
          <div>Access token: {token}</div>
        </div>
      )}
      {!error && !token && <div>Authorizing...</div>}
    </div>
  )
}
