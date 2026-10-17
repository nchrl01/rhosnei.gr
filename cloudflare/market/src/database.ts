import { ApiError } from './chains';
export interface DatabaseEnv { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string }
export async function database<T>(env: DatabaseEnv, path: string, init: RequestInit = {}): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new ApiError(503, 'database-unconfigured');
  let base: URL;
  try { base = new URL(env.SUPABASE_URL); } catch { throw new ApiError(503, 'invalid-database-configuration'); }
  if (base.protocol !== 'https:' || base.username || base.password) throw new ApiError(503, 'invalid-database-configuration');
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SECRET_KEY);
  // New sb_secret keys use apikey only; legacy service-role keys are JWTs.
  if (!env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) headers.set('Authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(new URL(`/rest/v1/${path}`, base), {
    ...init, headers, redirect: 'error', signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new ApiError(503, 'database-unavailable');
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
