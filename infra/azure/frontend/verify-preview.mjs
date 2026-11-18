import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const base = new URL(process.env.FRONTEND_URL)
assert(base.protocol === 'https:' && base.hostname.endsWith('.azurewebsites.net'))
assert(/^[a-f0-9]{40}$/.test(process.env.FRONTEND_EXPECT_COMMIT || ''))

async function probe(path, status = 200) {
  const response = await fetch(new URL(path, base), {
    redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store',
  })
  const body = await response.text()
  assert.equal(response.status, status, `${path}: unexpected HTTP status`)
  return { response, body }
}

let ready = false
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    await probe('/frontend-health')
    const { body } = await probe('/version.json')
    assert.equal(JSON.parse(body).commit, process.env.FRONTEND_EXPECT_COMMIT)
    ready = true
    break
  } catch {
    await setTimeout(5000)
  }
}
assert(ready, 'Frontend did not serve the expected release within the readiness window')
for (const path of ['/index.html', '/cash-summary/form', '/version.json', '/sw.js']) {
  const { response, body } = await probe(path)
  assert(response.headers.get('cache-control')?.includes('no-store'), `${path}: update caching`)
  if (path.endsWith('.html') || path === '/cash-summary/form') assert(body.includes('<html'))
}
await probe('/assets/does-not-exist.js', 404)
await probe('/api/health')
await probe('/login-auth/health')
await probe('/cdn/health')
await probe('/api/purchase-orders?limit=1', 401)
console.log('PASS: expected Azure release, SPA/update caching, API/auth/CDN health and protected API rejection')
