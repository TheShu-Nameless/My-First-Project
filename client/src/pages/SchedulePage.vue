<template>
  <div class="page">
    <el-card class="glass-panel">
      <template #header>排班查询与维护</template>
      <div class="toolbar">
        <el-select v-model="query.department_id" clearable placeholder="科室筛选" @change="loadSchedules">
          <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-date-picker v-model="query.date" type="date" value-format="YYYY-MM-DD" @change="loadSchedules" />
        <el-button @click="loadSchedules">刷新</el-button>
      </div>
      <el-table :data="schedules">
        <el-table-column prop="department_name" label="科室" min-width="120" />
        <el-table-column prop="doctor_name" label="医生" min-width="120" />
        <el-table-column label="时间" min-width="180">
          <template #default="{ row }">{{ row.schedule_date }} {{ row.start_time }}-{{ row.end_time }}</template>
        </el-table-column>
        <el-table-column label="号源情况" min-width="170">
          <template #default="{ row }">
            已约 {{ row.used_quota }}（剩余 {{ Math.max(Number(row.total_quota) - Number(row.used_quota), 0) }}）
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="100">
          <template #default="{ row }">{{ formatScheduleStatus(row.status) }}</template>
        </el-table-column>
        <el-table-column v-if="auth.isAdmin || auth.isStaff" width="90" label="操作">
          <template #default="{ row }">
            <el-button type="danger" text @click="removeSchedule(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card v-if="auth.isAdmin || auth.isStaff" class="glass-panel">
      <template #header>新增排班</template>
      <el-form :model="form" inline>
        <el-form-item label="医生">
          <el-select v-model="form.doctor_id" style="width: 180px">
            <el-option
              v-for="d in doctors"
              :key="d.id"
              :label="`${d.name} (${d.department_name})`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="form.schedule_date" value-format="YYYY-MM-DD" type="date" /></el-form-item>
        <el-form-item label="开始"><el-time-picker v-model="form.start_time" value-format="HH:mm:ss" /></el-form-item>
        <el-form-item label="结束"><el-time-picker v-model="form.end_time" value-format="HH:mm:ss" /></el-form-item>
        <el-form-item label="号源"><el-input-number v-model="form.total_quota" :min="1" :max="200" /></el-form-item>
        <el-form-item><el-button type="primary" @click="createSchedule">创建</el-button></el-form-item>
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
const departments = ref([]);
const doctors = ref([]);
const schedules = ref([]);
const query = reactive({ department_id: undefined, date: '' });
const form = reactive({
  doctor_id: undefined,
  schedule_date: '',
  start_time: '08:30:00',
  end_time: '11:30:00',
  total_quota: 20,
});
const SCHEDULE_STATUS_TEXT = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭',
};
const formatScheduleStatus = (status) => SCHEDULE_STATUS_TEXT[String(status || '').toLowerCase()] || status || '-';

const loadBase = async () => {
  const [a, b] = await Promise.all([http.get('/departments'), http.get('/doctors')]);
  departments.value = a.data.list || [];
  doctors.value = b.data.list || [];
};

const loadSchedules = async () => {
  const { data } = await http.get('/schedules', { params: query });
  schedules.value = data.list || [];
};

const createSchedule = async () => {
  await confirmZh('确认创建该排班？创建后将对患者可见。', '二次确认', { type: 'warning' });
  await http.post('/schedules', form);
  ElMessage.success('排班创建成功');
  await loadSchedules();
};

const removeSchedule = async (id) => {
  await confirmZh('删除后不可恢复，是否继续？', '二次确认', { type: 'warning' });
  await http.delete(`/schedules/${id}`);
  ElMessage.success('已删除');
  await loadSchedules();
};

onMounted(async () => {
  await loadBase();
  await loadSchedules();
});
</script>

<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
</style>
