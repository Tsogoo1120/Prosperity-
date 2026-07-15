import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

const session = ref(null)
const profile = ref(null)
const loading = ref(true)

async function fetchProfile(userId) {
  try {
    await supabase.rpc('claim_admin_if_allowlisted')
  } catch {
    // RPC may be unavailable before migration is applied
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url, subscription_status, reading_access_expires_at, role, is_admin')
    .eq('id', userId)
    .single()
  if (error) console.error('[auth] profile fetch failed:', error.message)
  profile.value = data ?? null
}

async function init() {
  loading.value = true
  const { data } = await supabase.auth.getSession()
  session.value = data.session ?? null
  if (session.value) await fetchProfile(session.value.user.id)

  supabase.auth.onAuthStateChange(async (_event, s) => {
    session.value = s ?? null
    if (s) {
      await fetchProfile(s.user.id)
    } else {
      profile.value = null
    }
    loading.value = false
  })

  loading.value = false
}

function isSubscriber() {
  return profile.value?.subscription_status === 'active'
}

// Collective reading pass: subscribers watch free; 15,000₮ buyers get a
// 30-day pass stored in reading_access_expires_at (no other subscriber perks).
function hasReadingAccess() {
  if (isSubscriber()) return true
  const exp = profile.value?.reading_access_expires_at
  return !!exp && new Date(exp) > new Date()
}

function isAdmin() {
  if (!session.value) return false
  if (profile.value?.role === 'admin' || profile.value?.is_admin) return true
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  if (adminEmail && session.value.user.email === adminEmail) return true
  return false
}

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

async function signOut() {
  await supabase.auth.signOut()
  session.value = null
  profile.value = null
}

async function updateProfile(updates) {
  if (!session.value) return
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: session.value.user.id, ...updates })
    .select('id, full_name, email, phone, avatar_url, subscription_status, reading_access_expires_at, role')
    .single()
  if (error) console.error('[auth] profile update failed:', error.message)
  if (data) profile.value = data
  return error ?? null
}

export function useAuth() {
  return { session, profile, loading, init, isAdmin, isSubscriber, hasReadingAccess, signInWithGoogle, signOut, updateProfile }
}
