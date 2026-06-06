<script setup>
import { computed, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import UiLogo from '@/components/common/UiLogo.vue'
import UiIcon from '@/components/common/UiIcon.vue'

const emit = defineEmits(['nav'])
const { session, profile, loading, signInWithGoogle, isAdmin } = useAuth()

const isSubscriber = computed(() => profile.value?.subscription_status === 'active')

watch(
  [loading, session],
  () => {
    if (!loading.value && session.value) {
      if (isAdmin()) {
        emit('nav', 'admin')
      } else {
        emit('nav', isSubscriber.value ? 'student' : 'enroll')
      }
    }
  },
  { immediate: true },
)

function login() {
  sessionStorage.setItem('union-post-oauth', JSON.stringify({ intent: 'login' }))
  signInWithGoogle()
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <UiLogo :size="28" />
      </div>

      <div class="login-body">
        <h1 class="login-title">Тавтай морилно уу</h1>
        <p class="login-sub muted">Google аккаунтаараа нэвтэрнэ үү</p>

        <button class="btn login-google-btn" :disabled="loading" @click="login">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Google-ээр нэвтрэх</span>
        </button>

        <div class="login-divider">
          <span class="muted" style="font-size: 13px">Subscriptiion байхгүй бол</span>
        </div>

        <button class="btn btn-ghost login-enroll-btn" @click="emit('nav', 'enroll')">
          Бүртгүүлэх <UiIcon name="arrowRight" :size="16" />
        </button>
      </div>

      <button class="btn btn-quiet btn-sm login-back" @click="emit('nav', 'landing')">
        <UiIcon name="arrowLeft" :size="15" /> Буцах
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  padding: 24px 16px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 40px 32px 32px;
  position: relative;
  box-shadow: var(--sh-lg);
}

.login-logo {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.login-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.login-title {
  font-size: 26px;
  font-family: var(--serif);
  font-weight: 700;
  margin: 0 0 8px;
  text-align: center;
  color: var(--ink);
}

.login-sub {
  font-size: 14.5px;
  margin: 0 0 28px;
  text-align: center;
}

.login-google-btn {
  width: 100%;
  justify-content: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 13px;
  border: 1.5px solid var(--line);
  background: var(--surface);
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.login-google-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-tint);
  box-shadow: var(--sh-sm);
}

.login-google-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin: 20px 0 16px;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}

.login-enroll-btn {
  width: 100%;
  justify-content: center;
  gap: 8px;
  border-radius: 13px;
  padding: 12px 20px;
  font-size: 14.5px;
}

.login-back {
  position: absolute;
  top: 16px;
  left: 16px;
}

@media (max-width: 480px) {
  .login-card {
    padding: 36px 20px 28px;
    border-radius: 20px;
  }
}
</style>
