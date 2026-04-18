import { computed, ref } from 'vue';

const THEME_KEY = 'tcm_theme';
const theme = ref('dark');

function applyTheme(next) {
  const v = next === 'light' ? 'light' : 'dark';
  theme.value = v;
  document.documentElement.setAttribute('data-theme', v);
  localStorage.setItem(THEME_KEY, v);
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

export function useTheme() {
  const isLight = computed(() => theme.value === 'light');
  const isDark = computed(() => theme.value === 'dark');
  const toggleTheme = () => applyTheme(theme.value === 'dark' ? 'light' : 'dark');
  return {
    theme,
    isLight,
    isDark,
    setTheme: applyTheme,
    toggleTheme,
  };
}
