import { createClient } from '@supabase/supabase-js'
// Kunci publishable memang untuk ditaruh di aplikasi. Keamanan data dijaga RLS di server.
export const SUPABASE_URL = 'https://dnnyhynvyoubqmgwrigc.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_hUEmXC0-sh9Lyy1eR-Zqzg_H3uMHKiK'
// Alur implisit: link masuk di email tetap berfungsi walau dibuka di browser lain (mis. dari aplikasi Gmail).
// Pesan galat link dibaca sebelum klien menghapusnya dari alamat.
export const GALAT_LINK = /error_code=otp_expired|error=access_denied/.test(location.hash + location.search)
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } })
export async function caraMasuk() {
  try { const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY } }); const j = await r.json(), x = j.external || {}; return { google: !!x.google, email: !!x.email, tamu: !!x.anonymous_users } } catch { return null }
}
