type Reply = { setHeader(name: string, value: string): void; status(code: number): Reply; json(value: unknown): void; end(): void };
export default async function handler(request: { method?: string }, response: Reply) {
  response.setHeader('Access-Control-Allow-Origin', 'https://nelsonfleitas.me');
  response.setHeader('Cache-Control', 'public, max-age=60');
  if (request.method !== 'GET') { response.status(405).end(); return; }
  try {
    const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Not configured');
    const result = await fetch(`${url}/rest/v1/rpc/registered_account_count`, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
    const count = Number(await result.json());
    if (!result.ok || !Number.isSafeInteger(count) || count < 0) throw new Error('Unavailable');
    response.status(200).json({ count });
  } catch { response.setHeader('Cache-Control', 'no-store'); response.status(503).json({ count: null }); }
}
