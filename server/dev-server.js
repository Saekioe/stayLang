// Local stand-in for Vercel. Serves the three functions in /api on http://localhost:3001
// so the Stripe CLI can forward webhooks to your own computer.
//
//   node --env-file=.env.local server/dev-server.js
//
// The Vite dev server sends every /api request here (see vite.config.js).
import { createServer } from 'node:http';

const PORT = 3001;

const routes = {
  '/api/create-checkout-session': () => import('../api/create-checkout-session.js'),
  '/api/stripe-webhook': () => import('../api/stripe-webhook.js'),
  '/api/refund-reservation': () => import('../api/refund-reservation.js'),
};

// Only the headers the functions read are passed on.
const FORWARDED = ['authorization', 'content-type', 'stripe-signature', 'origin'];

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const load = routes[pathname];
  if (!load) {
    res.writeHead(404).end('Not found');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method not allowed');
    return;
  }

  try {
    // Stripe signs the exact bytes it sends, so the body is passed on untouched.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    FORWARDED.forEach((name) => {
      if (req.headers[name]) headers.set(name, req.headers[name]);
    });
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: 'POST',
      headers,
      body: Buffer.concat(chunks),
    });

    const { POST } = await load();
    const response = await POST(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(`${pathname} failed:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error. Check the terminal running the API.' }));
  }
}).listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
  console.log('Forward Stripe webhooks with:');
  console.log(`  stripe listen --forward-to localhost:${PORT}/api/stripe-webhook`);
});