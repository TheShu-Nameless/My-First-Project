<template>
  <div class="page">
    <main class="card glass-panel">
      <div class="theme-row">
        <el-button class="theme-btn" circle aria-label="切换深浅色主题" @click="toggleTheme">
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </el-button>
      </div>
      <h1>门诊预约与智能分诊系统</h1>
      <el-form :model="form" label-position="top" autocomplete="off" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input v-model="form.username" size="large" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" size="large" type="password" autocomplete="new-password" />
        </el-form-item>
        <el-button type="primary" class="btn" size="large" native-type="submit" :loading="loading">登录</el-button>
        <el-button class="btn" size="large" @click="router.push('/register')">学生注册</el-button>
        <div class="forgot-wrap">
          <el-button text type="primary" @click="openResetDialog">找回密码</el-button>
        </div>
      </el-form>
    </main>
    <el-dialog v-model="resetDialogVisible" title="找回密码" width="460px">
      <el-form :model="resetForm" label-position="top">
        <el-form-item label="账号">
          <el-input v-model="resetForm.username" placeholder="请输入账号" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="resetForm.name" placeholder="请输入注册姓名" />
        </el-form-item>
        <el-form-item label="手机号（若已绑定则必填）">
          <el-input v-model="resetForm.phone" placeholder="请输入绑定手机号" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="resetForm.new_password" type="password" placeholder="至少8位" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="resetForm.confirm_password" type="password" placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetLoading" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/composables/useTheme';
import http from '@/api/http';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isDark, toggleTheme } = useTheme();
const loading = ref(false);
const resetLoading = ref(false);
const resetDialogVisible = ref(false);
const form = reactive({
  username: 'TheShu',
  password: '',
});
const resetForm = reactive({
  username: '',
  name: '',
  phone: '',
  new_password: '',
  confirm_password: '',
});

async function onSubmit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号与密码');
    return;
  }
  loading.value = true;
  try {
    await auth.login(form);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    router.push(redirect);
  } finally {
    loading.value = false;
  }
}

function openResetDialog() {
  resetDialogVisible.value = true;
  resetForm.username = form.username || '';
}

async function submitReset() {
  if (!resetForm.username || !resetForm.name || !resetForm.new_password || !resetForm.confirm_password) {
    ElMessage.warning('请填写完整找回信息');
    return;
  }
  resetLoading.value = true;
  try {
    const { data } = await http.post('/auth/forgot-password', resetForm, { skipErrorToast: true });
    ElMessage.success(data?.message || '密码重置成功');
    resetDialogVisible.value = false;
    form.username = resetForm.username;
    form.password = '';
    Object.assign(resetForm, {
      username: '',
      name: '',
      phone: '',
      new_password: '',
      confirm_password: '',
    });
  } catch (err) {
    const msg = err?.response?.data?.message || '找回密码失败，请稍后重试';
    ElMessage.error(msg);
  } finally {
    resetLoading.value = false;
  }
}

</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: min(460px, 100%);
  padding: 28px;
  position: relative;
}
h1 {
  margin: 0 0 8px;
  line-height: 1.35;
}
.sub {
  color: var(--tcm-muted);
  margin: 0 0 20px;
}
.btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  margin-left: 0 !important;
}
.forgot-wrap {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}
.forgot-wrap :deep(.el-button) {
  margin-left: 0;
  padding-inline: 12px;
}
.theme-row {
  position: absolute;
  right: 14px;
  top: 12px;
}
.theme-btn {
  border-color: var(--tcm-plain-border);
  background: var(--tcm-plain-bg);
  color: var(--tcm-text);
}
@media (max-width: 640px) {
  .page {
    padding: 12px;
  }
  .card {
    padding: 18px 14px 24px;
  }
  h1 {
    font-size: 24px;
    margin-right: 34px;
  }
}
</style>
