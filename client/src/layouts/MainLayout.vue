<template>
  <div class="shell">
    <aside class="side glass-panel" v-if="!isMobile">
      <div class="brand">
        <span class="logo">🏥</span>
        <div>
          <div class="title">门诊预约系统</div>
          <div class="sub">中医药 AI 分诊辅助</div>
        </div>
      </div>
      <el-menu class="menu" :default-active="active" router background-color="transparent" :text-color="menuTextColor" :active-text-color="menuActiveColor">
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="user glass-panel inner">
        <div class="u-meta">
          <div class="u-name">{{ auth.user?.name || auth.user?.username }}</div>
          <el-tag size="small" type="success" effect="dark" round>{{ roleLabel }}</el-tag>
        </div>
        <el-button class="logout" text type="danger" @click="logout">退出</el-button>
      </div>
    </aside>
    <main class="main">
      <header class="top glass-panel">
        <div class="top-left">
          <el-button v-if="isMobile" class="icon-btn" circle aria-label="打开导航菜单" @click="menuOpen = true">
            <el-icon><Menu /></el-icon>
          </el-button>
          <div class="crumb">{{ title }}</div>
        </div>
        <div class="top-actions">
          <el-button class="icon-btn" circle aria-label="切换深浅色主题" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
          </el-button>
          <el-button v-if="isMobile" text type="danger" @click="logout">退出</el-button>
        </div>
      </header>
      <section class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </section>
    </main>
    <el-drawer v-model="menuOpen" size="78%" direction="ltr" :with-header="false" class="mobile-menu">
      <div class="drawer-wrap">
        <div class="brand compact">
          <span class="logo">🏥</span>
          <div>
            <div class="title">门诊预约系统</div>
            <div class="sub">中医药 AI 分诊辅助</div>
          </div>
        </div>
        <el-menu class="menu" :default-active="active" router @select="menuOpen = false">
          <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu>
        <div class="drawer-user">
          <div>{{ auth.user?.name || auth.user?.username }}</div>
          <el-tag size="small" effect="dark" round>{{ roleLabel }}</el-tag>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/composables/useTheme';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isDark, toggleTheme } = useTheme();
const menuOpen = ref(false);
const isMobile = ref(window.innerWidth <= 960);

const active = computed(() => {
  return route.path;
});

const title = computed(() => route.meta.title || '工作台');
const menuTextColor = computed(() => (isDark.value ? 'rgba(255,255,255,0.86)' : 'rgba(26,51,72,0.85)'));
const menuActiveColor = computed(() => '#4a8fb6');

const menuItems = computed(() => {
  const base = [
    { path: '/dashboard', label: '首页概览', icon: 'Odometer' },
    { path: '/appointments', label: '挂号预约', icon: 'FolderOpened' },
    { path: '/schedules', label: '医生排班', icon: 'Calendar' },
    { path: '/records', label: '就诊记录', icon: 'Tickets' },
    { path: '/triage', label: 'AI 分诊', icon: 'MagicStick' },
  ];
  if (auth.isAdmin || auth.isStaff) {
    base.push({ path: '/admin', label: '后台管理', icon: 'Setting' });
  }
  return base;
});

const roleLabel = computed(() => {
  const r = String(auth.user?.role || '').trim().toLowerCase();
  if (r === 'admin') return '管理员';
  if (r === 'staff') return '值班人员';
  if (r === 'doctor') return '医生';
  if (r === 'patient') return '学生患者';
  return auth.user?.role ? String(auth.user.role) : '-';
});

function logout() {
  auth.clear();
  router.push('/login');
}

function onResize() {
  isMobile.value = window.innerWidth <= 960;
  if (!isMobile.value) menuOpen.value = false;
}

onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));
</script>

<style scoped lang="scss">
.shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  gap: 20px;
  padding: 20px;
}

.side {
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  position: sticky;
  top: 20px;
  height: calc(100vh - 40px);
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
}
.brand.compact {
  padding: 10px 2px 14px;
}
.logo {
  font-size: 28px;
  filter: drop-shadow(0 6px 16px rgba(74, 143, 182, 0.35));
}
.title {
  font-weight: 700;
  letter-spacing: 0.02em;
}
.sub {
  font-size: 12px;
  color: var(--tcm-muted);
  margin-top: 2px;
}

.menu {
  border-right: none;
  flex: 1;
  overflow: auto;
}
.menu :deep(.el-menu-item) {
  border-radius: 12px;
  margin: 4px 8px;
}
.menu :deep(.el-menu-item.is-active) {
  background: rgba(62, 207, 142, 0.12) !important;
}

.user.inner {
  margin-top: 12px;
  padding: 12px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.u-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.u-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logout {
  flex-shrink: 0;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.top {
  padding: 16px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.top-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  border-color: var(--tcm-plain-border);
  background: var(--tcm-plain-bg);
  color: var(--tcm-text);
}
.crumb {
  font-size: 20px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.content {
  flex: 1;
  min-height: 400px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.mobile-menu :deep(.el-drawer) {
  background: var(--tcm-bg-1);
}
.drawer-wrap {
  padding: 12px 10px;
  color: var(--tcm-text);
}
.drawer-user {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--tcm-plain-border);
  background: var(--tcm-plain-bg);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 960px) {
  .shell {
    grid-template-columns: 1fr;
    padding: 10px;
    gap: 10px;
  }
  .top {
    padding: 10px 12px;
  }
  .crumb {
    font-size: 18px;
  }
}
</style>
