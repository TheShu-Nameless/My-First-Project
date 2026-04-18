<template>
  <div class="page">
    <div class="stats-panel glass-panel">
      <div v-for="item in cards" :key="item.label" class="stat-item">
        <div class="card-label">{{ item.label }}</div>
        <div class="card-value">{{ item.value }}</div>
      </div>
    </div>
    <el-card class="glass-panel"><template #header>公告栏</template><el-timeline><el-timeline-item v-for="a in announcements" :key="a.id" :timestamp="fmt(a.created_at)"><strong>{{ a.title }}</strong><div class="muted">{{ a.content }}</div></el-timeline-item></el-timeline></el-card>
    <el-card class="glass-panel"><template #header>近期预约/就诊</template><div class="responsive-table"><el-table :data="upcoming"><el-table-column prop="department_name" label="科室" min-width="120" /><el-table-column prop="doctor_name" label="医生" min-width="120" /><el-table-column label="日期" min-width="120"><template #default="{ row }">{{ row.schedule_date?.slice(0, 10) }}</template></el-table-column><el-table-column label="时间段" min-width="140"><template #default="{ row }">{{ row.start_time }} - {{ row.end_time }}</template></el-table-column><el-table-column label="状态" min-width="100"><template #default="{ row }">{{ formatAppointmentStatus(row.status) }}</template></el-table-column></el-table></div></el-card>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import http from '@/api/http';
const stats = ref({});
const announcements = ref([]);
const upcoming = ref([]);
const APPOINTMENT_STATUS_TEXT = {
  booked: '已预约',
  checked_in: '已签到',
  completed: '已完成',
  cancelled: '已取消',
};
const cards = computed(() => [{ label: '科室总数', value: stats.value.departmentCount ?? 0 }, { label: '在岗医生', value: stats.value.doctorCount ?? 0 }, { label: '待诊预约', value: stats.value.activeAppointmentCount ?? 0 }, { label: '今日接诊量', value: stats.value.todayVisitCount ?? 0 }]);
const fmt = (v) => (v ? String(v).slice(0, 16).replace('T', ' ') : '');
const formatAppointmentStatus = (status) => APPOINTMENT_STATUS_TEXT[String(status || '').toLowerCase()] || status || '-';
onMounted(async () => {
  const { data } = await http.get('/dashboard/stats');
  stats.value = data.stats || {};
  announcements.value = data.announcements || [];
  upcoming.value = data.upcoming || [];
});
</script>
<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-radius: 14px;
  overflow: hidden;
}

.stat-item {
  padding: 18px 16px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item:last-child {
  border-right: none;
}

.card-label {
  color: var(--tcm-muted);
}

.card-value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
}

.muted {
  color: var(--tcm-muted);
}

@media (max-width: 980px) {
  .stats-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-item:nth-child(2n) {
    border-right: none;
  }

  .stat-item {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-item:nth-last-child(-n + 2) {
    border-bottom: none;
  }
}
</style>
