<script setup lang="ts">
import keycloak from '../keycloak';

defineProps<{ authenticated: boolean; username: string }>();

const login = () => keycloak.login();
const register = () => keycloak.register();
const logout = () => keycloak.logout({ redirectUri: window.location.origin });
</script>

<template>
  <div class="auth-wrap">
    <template v-if="authenticated">
      <span class="auth-username">{{ username }}</span>
      <button class="auth-btn auth-btn--outline" @click="logout">Logout</button>
    </template>
    <template v-else>
      <button class="auth-btn auth-btn--outline" @click="register">Register</button>
      <button class="auth-btn auth-btn--filled" @click="login">Login</button>
    </template>
  </div>
</template>

<style scoped>
.auth-wrap {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.auth-username {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
  opacity: 0.85;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auth-btn {
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.auth-btn--filled {
  background-color: var(--primary-color);
  color: #fff;
  border: 1px solid var(--primary-color);
}

.auth-btn--filled:hover {
  filter: brightness(1.1);
}

.auth-btn--outline {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.auth-btn--outline:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

</style>
