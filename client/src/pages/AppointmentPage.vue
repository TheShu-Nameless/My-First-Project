<template>
  <div class="page">
    <el-card class="glass-panel appt-card">
      <template #header>
        <div class="card-head">
          <span>可预约时段</span>
          <span v-if="schedules.length" class="card-head__hint">选择时段并填写症状（可选）后点击预约</span>
        </div>
      </template>
      <el-alert
        v-if="!auth.isPatient"
        type="warning"
        :closable="false"
        show-icon
        class="role-hint"
        title="当前登录角色不可在线预约号源"
        description="仅「学生患者」账号可点击预约。若您为学生，请用注册时的患者账号登录，或联系管理员将您的角色改为学生患者。"
      />
      <div class="toolbar">
        <el-select
          v-model="filters.department_id"
          placeholder="筛选科室"
          clearable
          class="toolbar__select"
          @change="loadSchedules"
        >
          <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-date-picker
          v-model="filters.date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          class="toolbar__date"
          @change="loadSchedules"
        />
        <el-button @click="loadSchedules">刷新</el-button>
      </div>

      <template v-if="schedules.length">
        <!-- 窄屏：卡片列表，避免宽表难操作 -->
        <div v-if="narrow" class="schedule-cards">
          <article v-for="row in schedules" :key="row.id" class="schedule-card">
            <div class="schedule-card__grid">
              <div>
                <div class="schedule-card__label">科室</div>
                <div class="schedule-card__value">{{ row.department_name }}</div>
              </div>
              <div>
                <div class="schedule-card__label">医生</div>
                <div class="schedule-card__value">{{ row.doctor_name }}</div>
              </div>
              <div class="schedule-card__span2">
                <div class="schedule-card__label">时间</div>
                <div class="schedule-card__value">{{ row.schedule_date }} {{ row.start_time }}–{{ row.end_time }}</div>
              </div>
              <div>
                <div class="schedule-card__label">剩余号源</div>
                <div class="schedule-card__value quota">{{ row.total_quota - row.used_quota }} / {{ row.total_quota }}</div>
              </div>
            </div>
            <div class="schedule-card__actions">
              <el-input
                v-model="symptomMap[row.id]"
                placeholder="简述症状（选填）"
                :disabled="!auth.isPatient"
                maxlength="120"
                show-word-limit
              />
              <el-button
                v-if="auth.isPatient"
                type="primary"
                class="schedule-card__book"
                round
                @click="book(row.id)"
              >
                预约该时段
              </el-button>
              <p v-else class="book-muted">当前账号不可预约</p>
            </div>
          </article>
        </div>
        <!-- 宽屏：表格 -->
        <div v-else class="table-scroll">
          <el-table :data="schedules" class="schedule-table" stripe>
            <el-table-column prop="department_name" label="科室" min-width="120" />
            <el-table-column prop="doctor_name" label="医生" min-width="120" />
            <el-table-column label="时间" min-width="180">
              <template #default="{ row }">{{ row.schedule_date }} {{ row.start_time }}–{{ row.end_time }}</template>
            </el-table-column>
            <el-table-column label="号源" min-width="100" align="center">
              <template #default="{ row }">{{ row.total_quota - row.used_quota }} / {{ row.total_quota }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="200" fixed="right" align="left">
              <template #default="{ row }">
                <div class="book-op">
                  <el-input
                    v-model="symptomMap[row.id]"
                    placeholder="简述症状（选填）"
                    :disabled="!auth.isPatient"
                    maxlength="120"
                    show-word-limit
                  />
                  <el-button v-if="auth.isPatient" type="primary" class="book-btn" round @click="book(row.id)">预约</el-button>
                  <span v-else class="book-muted">—</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
      <el-empty
        v-else
        description="暂无可预约时段，请联系管理员在「医生排班」页面发布排班"
      />
    </el-card>

    <el-card class="glass-panel appt-card">
      <template #header>
        <div class="card-head">
          <span>我的预约</span>
        </div>
      </template>
      <div class="table-scroll my-appt-scroll">
        <el-table :data="appointments" class="my-appt-table" stripe empty-text="暂无预约记录">
          <el-table-column prop="department_name" label="科室" min-width="110" />
          <el-table-column prop="doctor_name" label="医生" min-width="100" />
          <el-table-column label="时间" min-width="178">
            <template #default="{ row }">{{ row.schedule_date }} {{ row.start_time }}–{{ row.end_time }}</template>
          </el-table-column>
          <el-table-column label="状态" min-width="96">
            <template #default="{ row }">
              <el-tag size="small" effect="plain" round>{{ formatAppointmentStatus(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="260" fixed="right">
            <template #default="{ row }">
              <div class="my-appt-ops">
                <el-select
                  v-model="rescheduleTarget[row.id]"
                  placeholder="改约到…"
                  clearable
                  filterable
                  class="my-appt-select"
                >
                  <el-option
                    v-for="s in schedules"
                    :key="s.id"
                    :label="`${s.schedule_date} ${s.start_time}`"
                    :value="s.id"
                  />
                </el-select>
                <div class="my-appt-btns">
                  <el-button size="small" round :disabled="!rescheduleTarget[row.id]" @click="reschedule(row.id)">
                    改约
                  </el-button>
                  <el-button size="small" type="danger" plain round @click="cancel(row.id)">取消</el-button>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { confirmZh } from '@/utils/confirm';
import http from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const departments = ref([]);
const schedules = ref([]);
const appointments = ref([]);
const symptomMap = reactive({});
const rescheduleTarget = reactive({});
const filters = reactive({ department_id: undefined, date: '' });
const narrow = ref(false);

const APPOINTMENT_STATUS_TEXT = {
  booked: '已预约',
  checked_in: '已签到',
  completed: '已完成',
  cancelled: '已取消',
};
const formatAppointmentStatus = (status) => APPOINTMENT_STATUS_TEXT[String(status || '').toLowerCase()] || status || '-';

function updateNarrow() {
  narrow.value = window.matchMedia('(max-width: 720px)').matches;
}

const loadDepartments = async () => {
  const { data } = await http.get('/departments');
  departments.value = data.list || [];
};
const loadSchedules = async () => {
  const { data } = await http.get('/schedules', { params: filters });
  schedules.value = data.list || [];
};
const loadAppointments = async () => {
  const { data } = await http.get('/appointments');
  appointments.value = data.list || [];
};
const book = async (id) => {
  await confirmZh(
    '确认预约该时段？提交后可在「我的预约」中改约或取消。',
    '确认预约',
    { type: 'warning' },
  );
  await http.post('/appointments', { schedule_id: id, symptom: symptomMap[id] || '' });
  ElMessage.success('预约成功');
  await Promise.all([loadSchedules(), loadAppointments()]);
};
const cancel = async (id) => {
  await confirmZh('确认取消该预约？取消后将释放号源。', '取消预约', { type: 'warning' });
  await http.post(`/appointments/${id}/cancel`, { reason: '用户主动取消' });
  ElMessage.success('已取消');
  await Promise.all([loadSchedules(), loadAppointments()]);
};
const reschedule = async (id) => {
  await confirmZh('确认改约到所选新时段？', '改约确认', { type: 'warning' });
  await http.post(`/appointments/${id}/reschedule`, { schedule_id: rescheduleTarget[id] });
  ElMessage.success('改约成功');
  await Promise.all([loadSchedules(), loadAppointments()]);
};
onMounted(async () => {
  updateNarrow();
  window.addEventListener('resize', updateNarrow);
  await loadDepartments();
  await Promise.all([loadSchedules(), loadAppointments()]);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateNarrow));
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.appt-card :deep(.el-card__header) {
  padding: 14px 18px;
}
.card-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  font-weight: 650;
  font-size: 16px;
}
.card-head__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--tcm-muted);
}
.role-hint {
  margin-bottom: 12px;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  align-items: center;
}
.toolbar__select {
  min-width: 160px;
}
.toolbar__date {
  width: 160px;
}
.table-scroll {
  width: 100%;
  overflow-x: auto;
}
.schedule-table {
  min-width: 720px;
}
.book-op {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 4px 0;
}
.book-btn {
  align-self: flex-start;
}
.book-muted {
  margin: 0;
  font-size: 13px;
  color: var(--tcm-muted);
}

.schedule-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.schedule-card {
  padding: 16px 16px 14px;
  border-radius: 14px;
  border: 1px solid var(--tcm-plain-border);
  background: var(--tcm-plain-bg);
}
.schedule-card__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  margin-bottom: 14px;
}
.schedule-card__span2 {
  grid-column: 1 / -1;
}
.schedule-card__label {
  font-size: 12px;
  color: var(--tcm-muted);
  margin-bottom: 2px;
}
.schedule-card__value {
  font-size: 15px;
  font-weight: 600;
}
.schedule-card__value.quota {
  font-variant-numeric: tabular-nums;
}
.schedule-card__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.schedule-card__book {
  width: 100%;
}

.my-appt-scroll .my-appt-table {
  min-width: 640px;
}
.my-appt-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.my-appt-select {
  min-width: 160px;
  flex: 1 1 160px;
}
.my-appt-btns {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .my-appt-ops {
    flex-direction: column;
    align-items: stretch;
  }
  .my-appt-select {
    width: 100%;
  }
  .my-appt-btns {
    justify-content: flex-end;
  }
}
</style>
