import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

const session = ref(null)
const profile = ref(null)
const loading = ref(true)

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url, subscription_status, role')
    .eq('id', userId)
    .single()
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

function isAdmin() {
  if (!session.value) return false
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  if (adminEmail && session.value.user.email === adminEmail) return true
  return profile.value?.role === 'admin'
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
  const { data } = await supabase
    .from('profiles')
    .upsert({ id: session.value.user.id, ...updates })
    .select('id, full_name, email, phone, avatar_url, subscription_status, role')
    .single()
  if (data) profile.value = data
}

export function useAuth() {
  return { session, profile, loading, init, isAdmin, signInWithGoogle, signOut, updateProfile }
}
