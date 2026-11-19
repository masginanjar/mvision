import { createClient } from '@supabase/supabase-js'
// Kunci publishable memang untuk ditaruh di aplikasi. Keamanan data dijaga RLS di server.
export const SUPABASE_URL = 'https://dnnyhynvyoubqmgwrigc.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_hUEmXC0-sh9Lyy1eR-Zqzg_H3uMHKiK'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })
export async function caraMasuk() {
  try { const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }); const j = await r.json(), x = j.external || {}; return { google: !!x.google, email: !!x.email, tamu: !!x.anonymous_users } } catch { return null }
}
