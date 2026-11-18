const http = require('node:http');
// Synthetic data only. This handler also runs directly in the isolated Docker rehearsal.
const requests = [];
http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/_fixture/requests' && req.method === 'GET') return res.end(JSON.stringify(requests));
  if (req.url !== '/send' || req.method !== 'POST') { res.statusCode = 501; return res.end('{}'); }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = req.body || JSON.parse(Buffer.concat(chunks).toString() || '{}');
  requests.push(body);
  if (body.subject === 'fixture-failure') { res.statusCode = 503; return res.end('{"error":"fixture outage"}'); }
  res.end('{"accepted":true}');
}).listen(Number(process.env.PORT || 5002), '0.0.0.0');
