import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import http from '@/api/http';

const TOKEN_KEY = 'tcm_ai_token';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const user = ref(null);

  const roleNorm = computed(() => String(user.value?.role || '').trim().toLowerCase());

  const isAdmin = computed(() => roleNorm.value === 'admin');
  const isStaff = computed(() => roleNorm.value === 'staff');
  const isDoctor = computed(() => roleNorm.value === 'doctor');
  const isPatient = computed(() => roleNorm.value === 'patient');

  function setToken(t) {
    token.value = t;
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function clear() {
    setToken('');
    user.value = null;
  }

  async function login(payload) {
    const p = toRaw(payload);
    const { data } = await http.post('/auth/login', {
      username: String(p?.username ?? '').trim(),
      password: p?.password != null ? String(p.password) : '',
    });
    setToken(data.token);
    user.value = data.user;
    return data;
  }

  async function fetchMe() {
    if (!token.value) return null;
    const { data } = await http.get('/auth/me');
    user.value = data.user;
    return data.user;
  }

  return { token, user, isAdmin, isStaff, isDoctor, isPatient, setToken, clear, login, fetchMe };
});
