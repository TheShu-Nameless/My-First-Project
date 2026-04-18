import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { guest: true } },
  { path: '/register', component: () => import('@/pages/RegisterPage.vue'), meta: { guest: true } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('@/pages/HomePage.vue'), meta: { title: '首页概览' } },
      { path: 'appointments', component: () => import('@/pages/AppointmentPage.vue'), meta: { title: '挂号预约' } },
      { path: 'schedules', component: () => import('@/pages/SchedulePage.vue'), meta: { title: '医生排班' } },
      { path: 'records', component: () => import('@/pages/RecordPage.vue'), meta: { title: '就诊记录' } },
      { path: 'triage', component: () => import('@/pages/TriagePage.vue'), meta: { title: 'AI 分诊' } },
      {
        path: 'admin',
        component: () => import('@/pages/AdminPage.vue'),
        meta: { roles: ['admin', 'staff'], title: '后台管理' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore();
  if (to.meta.auth && !auth.token) {
    return next({ path: '/login', query: { redirect: to.fullPath } });
  }
  if (auth.token && !auth.user && to.meta.auth) {
    try {
      await auth.fetchMe();
    } catch {
      auth.clear();
      return next({ path: '/login' });
    }
  }
  if (to.meta.guest && auth.token) {
    return next({ path: '/dashboard' });
  }
  if (to.meta.roles?.length) {
    if (!to.meta.roles.includes(auth.user?.role)) {
      return next({ path: '/dashboard' });
    }
  }
  return next();
});

export default router;
