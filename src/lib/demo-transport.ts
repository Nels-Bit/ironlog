import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type DemoRow = Record<string, unknown>;
export type DemoSeed = { user: User; tables: Record<string, DemoRow[]>; profileTable?: string };

/** A local PostgREST-compatible provider. It never calls fetch or authenticates.
 * Existing query builders/business logic run unchanged; unknown operations fail closed.
 * The invalid origin is deliberate: even an unsupported SDK path cannot reach production.
 */
export function createDemoProvider(seed: DemoSeed, onExit: () => void = () => {}) {
  let state = structuredClone(seed);
  const unavailable = () => ({ data: null, error: new Error('Unavailable in Demo Mode.') });
  function matches(row: DemoRow, field: string, expression: string): boolean {
    const dot = expression.indexOf('.');
    const operator = expression.slice(0, dot), value = expression.slice(dot + 1);
    const actual = row[field];
    if (operator === 'eq') return String(actual) === value;
    if (operator === 'neq') return String(actual) !== value;
    if (operator === 'is') return value === 'null' ? actual == null : String(actual) === value;
    if (operator === 'in') return value.replace(/^\(|\)$/g, '').split(',').map(v => v.replace(/^"|"$/g, '')).includes(String(actual));
    if (operator === 'ilike') return String(actual ?? '').toLowerCase().includes(value.replace(/%/g, '').toLowerCase());
    if (operator === 'cs') {
      const expected = JSON.parse(value) as DemoRow[];
      return Array.isArray(actual) && expected.every(part => actual.some(item => Object.entries(part).every(([k, v]) => (item as DemoRow)[k] === v)));
    }
    if (operator === 'gt') return String(actual) > value;
    if (operator === 'gte') return String(actual) >= value;
    if (operator === 'lt') return String(actual) < value;
    if (operator === 'lte') return String(actual) <= value;
    throw new Error(`Unsupported demo filter: ${operator}`);
  }
  const response = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
  const transport: typeof fetch = async (input, init) => {
    try {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== 'https://demo.invalid') return response({ message: 'Demo network access blocked.' }, 403);
      if (url.pathname === '/rest/v1/rpc/ensure_current_user_profile') {
        const profile = state.tables[state.profileTable ?? 'user_profiles']?.find(r => r.user_id === state.user.id);
        return profile ? response(profile) : response({ message: 'Demo profile missing.' }, 404);
      }
      const match = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
      const table = match?.[1];
      if (!table || !Object.hasOwn(state.tables, table)) return response({ message: 'Unavailable in Demo Mode.' }, 403);
      const rows = state.tables[table];
      const parameters = url.searchParams;
      const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
      const filter = (row: DemoRow) => [...parameters].every(([key, value]) => {
        if (reserved.has(key)) return true;
        if (key === 'or') return value.replace(/^\(|\)$/g, '').split(',').some(term => {
          const dot = term.indexOf('.');
          return matches(row, term.slice(0, dot), term.slice(dot + 1));
        });
        return matches(row, key, value);
      });
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      let result = rows.filter(filter);
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const values: DemoRow[] = Array.isArray(body) ? body : [body];
        const primaryKey = ['heights', 'public_profiles', 'user_profiles'].includes(table) ? ['user_id'] : ['id'];
        const conflict = parameters.get('on_conflict')?.split(',') ?? (headers.get('prefer')?.includes('resolution=merge-duplicates') ? primaryKey : []);
        result = values.map(value => {
          const existing = conflict.length ? rows.find(r => conflict.every(k => r[k] === value[k])) : undefined;
          const now = new Date().toISOString();
          if (existing) { Object.assign(existing, value, { updated_at: now }); return existing; }
          const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, read_at: null, responded_at: null, ...value };
          rows.push(row); return row;
        });
      } else if (method === 'PATCH') {
        const value = JSON.parse(String(init?.body ?? '{}')) as DemoRow;
        result.forEach(row => Object.assign(row, value, { updated_at: new Date().toISOString() }));
      } else if (method === 'DELETE') {
        state.tables[table] = rows.filter(row => !filter(row));
      } else if (method !== 'GET' && method !== 'HEAD') return response({ message: 'Unavailable in Demo Mode.' }, 403);
      const count = result.length;
      const order = parameters.get('order');
      if (order) result = [...result].sort((a, b) => {
        for (const term of order.split(',')) {
          const [field, direction] = term.split('.');
          if (a[field] === b[field]) continue;
          const first = a[field] as string | number, second = b[field] as string | number;
          return (first < second ? -1 : 1) * (direction === 'desc' ? -1 : 1);
        }
        return 0;
      });
      const offset = Number(parameters.get('offset') ?? 0), limit = Number(parameters.get('limit') ?? count);
      result = result.slice(offset, offset + limit);
      const selected = parameters.get('select');
      if (selected && selected !== '*') result = result.map(row => Object.fromEntries(selected.split(',').map(k => [k, row[k]])));
      const range = { 'content-range': `0-${Math.max(0, result.length - 1)}/${count}` };
      if (method === 'HEAD') return response(undefined, 200, range);
      if (headers.get('accept')?.includes('application/vnd.pgrst.object+json')) {
        if (result.length !== 1) return response({ code: 'PGRST116', message: 'Expected one demo record.', details: `The result contains ${result.length} rows` }, 406);
        return response(result[0], 200, range);
      }
      return response(result, 200, range);
    } catch (error) { return response({ message: error instanceof Error ? error.message : 'Demo operation failed.' }, 400); }
  };
  const client = createClient('https://demo.invalid', 'demo-local-only-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  });
  const auth = {
    getUser: async () => ({ data: { user: structuredClone(state.user) }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    updateUser: async (updates: { data?: DemoRow; email?: string; password?: string }) => {
      if (updates.email !== undefined || updates.password !== undefined || !updates.data) return unavailable();
      Object.assign(state.user.user_metadata, updates.data);
      return { data: { user: structuredClone(state.user) }, error: null };
    },
    signOut: async () => { onExit(); return { error: null }; },
  };
  // Auth and realtime are local stubs. All unimplemented capabilities are blocked,
  // not delegated to the SDK. The SDK is used only for its familiar query builder.
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => 'ok' };
  const blocked = new Proxy({}, { get: () => async () => unavailable() });
  const storage = { from: () => blocked };
  const facade = new Proxy(client, { get(target, property) {
    if (property === 'auth') return new Proxy(auth, { get: (targetAuth, key) => key in targetAuth ? targetAuth[key as keyof typeof auth] : async () => unavailable() });
    if (property === 'channel') return () => channel;
    if (property === 'removeChannel') return async () => 'ok';
    if (property === 'storage') return storage;
    if (property === 'functions' || property === 'realtime') return blocked;
    if (property === 'from' || property === 'rpc') return target[property].bind(target);
    return undefined;
  } }) as SupabaseClient;
  return { client: facade, reset: () => { state = structuredClone(seed); }, snapshot: () => structuredClone(state), transport };
}
