<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterView, RouterLink, useRouter } from 'vue-router';
import AuthButton from './components/AuthButton.vue';
import keycloak from './keycloak';

const router = useRouter();
const authenticated = ref(false);
const username = ref('');
const isDarkMode = ref(true);
const isMenuOpen = ref(false);
const navbarRef = ref<HTMLElement | null>(null);

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.setAttribute('data-theme', isDarkMode.value ? 'dark' : 'light');
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

function login() {
  closeMenu();
  keycloak.login();
}

function register() {
  closeMenu();
  keycloak.register();
}

function logout() {
  closeMenu();
  keycloak.logout({ redirectUri: window.location.origin });
}

function handleClickOutside(e: MouseEvent) {
  if (navbarRef.value && !navbarRef.value.contains(e.target as Node)) {
    closeMenu();
  }
}

onMounted(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  // Detect post-login callback — Keycloak appends code= and state= to the redirect URI
  const isLoginCallback = window.location.hash.includes('code=');
  // check-sso redirects back with error=login_required when not authenticated.
  // With hash routing this lands as /#/&error=... which matches no route — clean it up.
  const hasOAuthParams = window.location.hash.includes('&') || window.location.search.length > 0;

  keycloak
    .init({ onLoad: 'check-sso', checkLoginIframe: false })
    .then((auth) => {
      authenticated.value = auth;
      if (auth) {
        username.value = keycloak.tokenParsed?.preferred_username ?? '';
        keycloak.onTokenExpired = () => keycloak.updateToken(60);
        router.replace(isLoginCallback ? '/profile' : '/');
      } else if (hasOAuthParams) {
        // Remove leftover OAuth2 params so the Planner route renders correctly.
        router.replace('/');
      }
    });
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <nav class="navbar" ref="navbarRef">
    <!-- Desktop layout -->
    <div class="navbar-left">
      <RouterLink to="/" class="navbar-brand">
        <span class="brand-icon">✈</span><span class="brand-text"> Itinerary</span>
      </RouterLink>
      <div class="navbar-links">
        <RouterLink to="/" class="nav-link">Planner</RouterLink>
        <RouterLink v-if="authenticated" to="/profile" class="nav-link">My Trips</RouterLink>
      </div>
    </div>
    <div class="navbar-right">
      <AuthButton :authenticated="authenticated" :username="username" />
      <button class="theme-btn" @click="toggleTheme" :title="isDarkMode ? 'Light mode' : 'Dark mode'">
        {{ isDarkMode ? '☀️' : '🌙' }}
      </button>
    </div>

    <!-- Hamburger button (mobile only) -->
    <button
      class="hamburger"
      :class="{ 'hamburger--open': isMenuOpen }"
      @click="toggleMenu"
      aria-label="Toggle menu"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <!-- Mobile dropdown -->
    <div class="mobile-menu" :class="{ 'mobile-menu--open': isMenuOpen }">
      <RouterLink to="/" class="mobile-nav-link" @click="closeMenu">Planner</RouterLink>
      <RouterLink v-if="authenticated" to="/profile" class="mobile-nav-link" @click="closeMenu">My Trips</RouterLink>
      <div class="mobile-divider" />
      <div class="mobile-footer">
        <span v-if="authenticated" class="mobile-username">{{ username }}</span>
        <button v-if="authenticated" class="mobile-auth-btn mobile-auth-btn--outline" @click="logout">Logout</button>
        <button v-else class="mobile-auth-btn mobile-auth-btn--outline" @click="register">Register</button>
        <button v-else class="mobile-auth-btn mobile-auth-btn--filled" @click="login">Login</button>
        <button class="mobile-theme-btn" @click="() => { toggleTheme(); closeMenu(); }">
          {{ isDarkMode ? '☀️ Light mode' : '🌙 Dark mode' }}
        </button>
      </div>
    </div>
  </nav>

  <div class="page-content">
    <RouterView :isDarkMode="isDarkMode" :authenticated="authenticated" />
  </div>
</template>

<style scoped>
/* ── Navbar shell ─────────────────────────────────────────── */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  background-color: var(--input-bg);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(8px);
}

/* ── Desktop left cluster ─────────────────────────────────── */
.navbar-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.navbar-brand {
  font-size: 1rem;
  font-weight: 700;
  color: var(--primary-color);
  text-decoration: none;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-link {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  border-radius: 6px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.nav-link:hover {
  background-color: var(--border-color);
  color: var(--primary-color);
}

.nav-link.router-link-active {
  color: var(--primary-color);
  background-color: color-mix(in srgb, var(--primary-color) 12%, transparent);
}

/* ── Desktop right cluster ────────────────────────────────── */
.navbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 1rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  line-height: 1;
}

.theme-btn:hover {
  background-color: var(--border-color);
  border-color: var(--primary-color);
}

/* ── Hamburger (mobile only) ──────────────────────────────── */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 0 7px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background-color: var(--text-color);
  border-radius: 2px;
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.hamburger--open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.hamburger--open span:nth-child(2) {
  opacity: 0;
}
.hamburger--open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ── Mobile dropdown ──────────────────────────────────────── */
.mobile-menu {
  display: none;
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  background-color: var(--input-bg);
  border-bottom: 1px solid var(--border-color);
  flex-direction: column;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.25s ease;
}

.mobile-menu--open {
  max-height: 320px;
}

.mobile-nav-link {
  padding: 0.875rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.mobile-nav-link:hover,
.mobile-nav-link.router-link-active {
  background-color: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.mobile-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 0.25rem 0;
}

.mobile-footer {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1.5rem;
  flex-wrap: wrap;
}

.mobile-username {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
  opacity: 0.8;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-auth-btn {
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.mobile-auth-btn--filled {
  background-color: var(--primary-color);
  color: #fff;
  border: 1px solid var(--primary-color);
}

.mobile-auth-btn--filled:hover {
  filter: brightness(1.1);
}

.mobile-auth-btn--outline {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.mobile-auth-btn--outline:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.mobile-theme-btn {
  margin-left: auto;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}

.mobile-theme-btn:hover {
  background-color: var(--border-color);
  border-color: var(--primary-color);
}

/* ── Page offset ──────────────────────────────────────────── */
.page-content {
  padding-top: 56px;
}

/* ── Responsive breakpoint ────────────────────────────────── */
@media (max-width: 560px) {
  .navbar-links,
  .navbar-right {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .mobile-menu {
    display: flex;
  }
}
</style>
