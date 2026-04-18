<template>
  <div class="page">
    <main class="card glass-panel">
      <h1>学生患者注册</h1>
      <p class="sub">注册后默认角色为学生患者，可直接预约挂号。</p>
      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input v-model="form.username" size="large" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" size="large" />
        </el-form-item>
        <el-form-item label="学号">
          <el-input v-model="form.student_no" size="large" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" size="large" />
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="form.gender" style="width: 100%" size="large">
            <el-option label="未知" value="unknown" />
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" size="large" type="password" />
        </el-form-item>
        <el-form-item label="再次确认密码">
          <el-input v-model="form.confirmPassword" size="large" type="password" />
        </el-form-item>
        <el-button type="primary" class="btn" size="large" native-type="submit" :loading="loading">
          提交注册
        </el-button>
        <div class="foot"><router-link to="/login">返回登录</router-link></div>
      </el-form>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '@/api/http';

const router = useRouter();
const loading = ref(false);
const form = reactive({
  username: '',
  name: '',
  student_no: '',
  phone: '',
  gender: 'unknown',
  password: '',
  confirmPassword: '',
});

const onSubmit = async () => {
  if (!form.username || !form.name || !form.password) {
    ElMessage.warning('请至少填写账号、姓名、密码');
    return;
  }
  if (form.password !== form.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致，请检查后重试');
    return;
  }
  loading.value = true;
  try {
    await http.post('/auth/register', {
      username: form.username,
      name: form.name,
      student_no: form.student_no,
      phone: form.phone,
      gender: form.gender,
      password: form.password,
    });
    ElMessage.success('注册成功，请登录');
    router.push('/login');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.card {
  width: min(500px, 100%);
  padding: 28px;
}
h1 {
  margin: 0 0 8px;
}
.sub {
  color: var(--tcm-muted);
  margin: 0 0 20px;
}
.btn {
  width: 100%;
  margin-top: 8px;
}
.foot {
  margin-top: 14px;
  text-align: center;
}
.foot a {
  color: var(--tcm-accent-2);
  text-decoration: none;
}
</style>
