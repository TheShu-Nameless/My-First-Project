<template>
  <div class="page">
    <el-card class="glass-panel">
      <template #header>就诊记录列表</template>
      <el-table :data="records">
        <el-table-column prop="patient_name" label="患者" min-width="120" />
        <el-table-column prop="doctor_name" label="医生" min-width="120" />
        <el-table-column prop="department_name" label="科室" min-width="120" />
        <el-table-column prop="diagnosis" label="诊断" min-width="220" show-overflow-tooltip />
        <el-table-column prop="prescription" label="处方" min-width="180" show-overflow-tooltip />
        <el-table-column label="时间" min-width="140">
          <template #default="{ row }">{{ row.created_at?.slice(0, 16).replace('T', ' ') }}</template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card v-if="auth.isDoctor || auth.isAdmin || auth.isStaff" class="glass-panel">
      <template #header>新增就诊记录</template>
      <el-form :model="form" label-width="90px">
        <el-form-item label="预约ID"><el-input-number v-model="form.appointment_id" :min="1" /></el-form-item>
        <el-form-item label="诊断结果"><el-input v-model="form.diagnosis" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="处方"><el-input v-model="form.prescription" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="医嘱"><el-input v-model="form.advice" type="textarea" :rows="2" /></el-form-item>
        <el-form-item><el-button type="primary" @click="createRecord">保存记录</el-button></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { confirmZh } from '@/utils/confirm';
import http from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const records = ref([]);
const form = reactive({ appointment_id: null, diagnosis: '', prescription: '', advice: '' });
const loadRecords = async () => {
  const { data } = await http.get('/records');
  records.value = data.list || [];
};
const createRecord = async () => {
  await confirmZh('确认保存该就诊记录？保存后会把预约状态更新为已完成。', '二次确认', { type: 'warning' });
  await http.post('/records', form);
  ElMessage.success('病历已保存');
  Object.assign(form, { appointment_id: null, diagnosis: '', prescription: '', advice: '' });
  await loadRecords();
};
onMounted(loadRecords);
</script>
<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
</style>
