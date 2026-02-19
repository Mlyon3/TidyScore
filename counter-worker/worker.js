const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const KV_KEY = 'global_total';
const MAX_DELTA = 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/counter/total' && request.method === 'GET') {
      const stored = await env.COUNTER_KV.get(KV_KEY);
      const total = Number(stored) || 0;
      return json({ total });
    }

    if (path === '/counter/increment' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const delta = Number(body.delta);
      if (!Number.isFinite(delta) || delta < 1 || delta > MAX_DELTA || delta !== Math.floor(delta)) {
        return json({ error: 'delta must be an integer between 1 and 1000' }, 400);
      }

      const stored = await env.COUNTER_KV.get(KV_KEY);
      const current = Number(stored) || 0;
      const newTotal = current + delta;
      await env.COUNTER_KV.put(KV_KEY, String(newTotal));

      return json({ total: newTotal });
    }

    return json({ error: 'Not found' }, 404);
  },
};
