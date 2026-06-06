import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

type Profile = {
  role?: string
  subscription_status?: string | null
  subscription_expires_at?: string | null
}

export function canAccessSubscriberContent(profile: Profile | null): boolean {
  if (!profile) return false
  if (profile.role === 'admin') return true
  if (profile.subscription_status === 'active') {
    if (!profile.subscription_expires_at) return true
    return new Date(profile.subscription_expires_at) > new Date()
  }
  return false
}

export async function requireUser(req: Request): Promise<
  | { ok: true; user: User; userClient: SupabaseClient; admin: SupabaseClient }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { ok: false, response: json({ error: 'not_authenticated' }, 401) }

  const SB_URL = Deno.env.get('SUPABASE_URL')!
  const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
  const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(SB_URL, SB_ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return { ok: false, response: json({ error: 'not_authenticated' }, 401) }

  const admin = createClient(SB_URL, SB_SERVICE)
  return { ok: true, user, userClient, admin }
}
