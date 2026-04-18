<template>
  <div class="page">
    <el-card class="glass-panel">
      <template #header>用户维护（管理员）</template>
      <el-form :model="userForm" inline>
        <el-form-item label="账号"><el-input v-model="userForm.username" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="userForm.name" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width: 120px">
            <el-option label="值班人员" value="staff" />
            <el-option label="学生患者" value="patient" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码"><el-input v-model="userForm.password" show-password /></el-form-item>
        <el-form-item><el-button type="primary" @click="createUser">创建用户</el-button></el-form-item>
      </el-form>
      <div class="section-toggle">
        <el-button text type="primary" @click="showUsers = !showUsers">
          {{ showUsers ? '收起用户列表' : '展开用户列表' }}（{{ users.length }}）
        </el-button>
      </div>
      <el-collapse-transition>
        <div v-show="showUsers">
          <el-table :data="users">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="username" label="账号" min-width="120" />
            <el-table-column prop="name" label="姓名" min-width="120" />
            <el-table-column label="角色" min-width="100">
              <template #default="{ row }">{{ formatRole(row.role) }}</template>
            </el-table-column>
            <el-table-column prop="phone" label="手机号" min-width="130" />
          </el-table>
        </div>
      </el-collapse-transition>
    </el-card>

    <el-card class="glass-panel">
      <template #header>公告维护</template>
      <el-form :model="annForm" label-width="70px">
        <el-form-item label="标题"><el-input v-model="annForm.title" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="annForm.content" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="annForm.is_active" /></el-form-item>
        <el-form-item><el-button type="primary" @click="createAnnouncement">发布公告</el-button></el-form-item>
      </el-form>
      <el-table :data="announcements">
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
        <el-table-column prop="is_active" label="启用" min-width="90" />
      </el-table>
    </el-card>

    <el-card v-if="auth.isAdmin" class="glass-panel">
      <template #header>系统配置（含备份）</template>
      <el-alert
        :closable="false"
        type="info"
        show-icon
        :title="`上传限制：单次最多 ${uploadPolicy.max_files} 个文件，单个不超过 ${uploadPolicy.max_file_size_mb}MB，允许 ${uploadPolicy.allowed_extensions.join('、')}`"
      />
      <el-form :model="settingsForm" label-width="120px" class="settings-form">
        <el-form-item label="AI Base URL"><el-input v-model="settingsForm.ai_api_base" /></el-form-item>
        <el-form-item label="AI Host Header"><el-input v-model="settingsForm.ai_host_header" placeholder="可选，例如 ds.local.ai（用于网关域名转发）" /></el-form-item>
        <el-form-item label="AI 模型"><el-input v-model="settingsForm.ai_model" /></el-form-item>
        <el-form-item label="AI Key">
          <el-input
            v-model="settingsForm.ai_api_key"
            show-password
            :placeholder="isOllamaMode() ? 'Ollama 本地模式可留空' : '输入新 Key 后保存；出于安全不会回显旧 Key'"
          />
        </el-form-item>
        <el-alert
          v-if="aiKeySavedHint"
          :closable="false"
          show-icon
          type="success"
          title="AI Key 已保存（安全策略不回显明文）"
          class="small-gap"
        />
        <el-form-item label="分诊规则版本"><el-input v-model="settingsForm.triage_prompt_version" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存配置（自动备份）</el-button>
          <el-button @click="loadSettings">重载</el-button>
          <el-button type="info" plain @click="applyOllamaPreset">一键切换Ollama</el-button>
          <el-button type="success" plain @click="testAi">测试AI连通性</el-button>
          <el-button type="warning" plain @click="autoSelectModel">自动选择可用模型</el-button>
        </el-form-item>
      </el-form>
      <div class="section-toggle">
        <el-button text type="primary" @click="showBackups = !showBackups">
          {{ showBackups ? '收起配置备份列表' : '展开配置备份列表' }}（{{ backups.length }}）
        </el-button>
      </div>
      <el-collapse-transition>
        <div v-show="showBackups">
          <el-table :data="backups">
            <el-table-column prop="id" label="备份ID" width="90" />
            <el-table-column prop="changed_keys" label="变更字段" min-width="220" />
            <el-table-column prop="actor_username" label="操作者" width="120" />
            <el-table-column prop="created_at" label="时间" min-width="180" />
          </el-table>
        </div>
      </el-collapse-transition>
    </el-card>

    <el-card v-if="auth.isAdmin" class="glass-panel">
      <template #header>基础审计日志（仅管理员）</template>
      <div class="toolbar">
        <el-input v-model="auditQuery.action" placeholder="按动作筛选，如 auth.login" style="width: 220px" />
        <el-select v-model="auditQuery.status" clearable placeholder="状态" style="width: 120px">
          <el-option label="成功" value="ok" />
          <el-option label="失败" value="fail" />
        </el-select>
        <el-button @click="loadAuditLogs">筛选</el-button>
        <el-button text type="primary" @click="showAuditLogs = !showAuditLogs">
          {{ showAuditLogs ? '收起审计日志列表' : '展开审计日志列表' }}（{{ auditLogs.length }}）
        </el-button>
      </div>
      <el-collapse-transition>
        <div v-show="showAuditLogs">
          <el-table :data="auditLogs">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="action" label="动作" min-width="170" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">{{ formatAuditStatus(row.status) }}</template>
            </el-table-column>
            <el-table-column prop="actor_username" label="操作人" width="120" />
            <el-table-column prop="target_type" label="对象类型" width="120" />
            <el-table-column prop="target_id" label="对象ID" width="100" />
            <el-table-column prop="detail" label="详情" min-width="260" show-overflow-tooltip />
            <el-table-column prop="created_at" label="时间" min-width="180" />
          </el-table>
        </div>
      </el-collapse-transition>
    </el-card>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { confirmZh } from '@/utils/confirm';
import http from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const users = ref([]);
const announcements = ref([]);
const backups = ref([]);
const auditLogs = ref([]);
const uploadPolicy = ref({ max_files: 10, max_file_size_mb: 20, allowed_extensions: [] });
const userForm = reactive({ username: '', name: '', role: 'staff', password: '12345678' });
const annForm = reactive({ title: '', content: '', is_active: true });
const settingsForm = reactive({
  ai_api_base: '',
  ai_host_header: '',
  ai_model: '',
  ai_api_key: '',
  triage_prompt_version: '',
});
const auditQuery = reactive({ action: '', status: '' });
const aiKeySavedHint = ref(false);
const showUsers = ref(false);
const showBackups = ref(false);
const showAuditLogs = ref(false);
const ROLE_TEXT = {
  admin: '管理员',
  staff: '值班人员',
  doctor: '医生',
  patient: '学生患者',
};
const AUDIT_STATUS_TEXT = {
  ok: '成功',
  fail: '失败',
};
const formatRole = (role) => ROLE_TEXT[String(role || '').toLowerCase()] || role || '-';
const formatAuditStatus = (status) => AUDIT_STATUS_TEXT[String(status || '').toLowerCase()] || status || '-';

const loadUsers = async () => {
  if (!auth.isAdmin) return;
  const { data } = await http.get('/admin/users');
  users.value = data.list || [];
};
const loadAnnouncements = async () => {
  const { data } = await http.get('/admin/announcements');
  announcements.value = data.list || [];
};
const loadSettings = async () => {
  if (!auth.isAdmin) return;
  const { data } = await http.get('/admin/settings');
  Object.assign(settingsForm, {
    ai_api_base: data.settings?.ai_api_base || '',
    ai_host_header: data.settings?.ai_host_header || '',
    ai_model: data.settings?.ai_model || '',
    ai_api_key: '',
    triage_prompt_version: data.settings?.triage_prompt_version || 'v1',
  });
  aiKeySavedHint.value = Boolean(data.settings?.ai_api_key);
};
const loadBackups = async () => {
  if (!auth.isAdmin) return;
  const { data } = await http.get('/admin/settings/backups');
  backups.value = data.list || [];
};
const loadAuditLogs = async () => {
  if (!auth.isAdmin) return;
  const { data } = await http.get('/admin/audit-logs', { params: auditQuery });
  auditLogs.value = data.list || [];
};
const loadUploadPolicy = async () => {
  const { data } = await http.get('/public/upload-policy');
  uploadPolicy.value = data.policy || uploadPolicy.value;
};

const createUser = async () => {
  if (!auth.isAdmin) return;
  await confirmZh('确认创建该用户？', '二次确认', { type: 'warning' });
  await http.post('/admin/users', userForm);
  ElMessage.success('用户创建成功');
  await loadUsers();
};
const createAnnouncement = async () => {
  await confirmZh('确认发布公告？', '二次确认', { type: 'warning' });
  await http.post('/admin/announcements', annForm);
  ElMessage.success('公告发布成功');
  Object.assign(annForm, { title: '', content: '', is_active: true });
  await loadAnnouncements();
};
const saveSettings = async () => {
  await confirmZh('确认保存系统配置？系统会自动生成备份记录。', '二次确认', { type: 'warning' });
  await http.patch('/admin/settings', settingsForm);
  ElMessage.success('配置已保存并备份');
  settingsForm.ai_api_key = '';
  aiKeySavedHint.value = true;
  await Promise.all([loadSettings(), loadBackups(), loadAuditLogs()]);
};

const testAi = async () => {
  try {
    const { data } = await http.post('/admin/settings/ai-test', {}, { skipErrorToast: true });
    await ElMessageBox.alert(
      `状态：成功\n模型：${settingsForm.ai_model || '（当前配置）'}\n返回：${data?.preview || 'AI连接正常'}`,
      'AI 连通性测试结果',
      { confirmButtonText: '知道了', type: 'success' },
    );
  } catch (err) {
    const msg = err?.response?.data?.message || 'AI 测试失败';
    await ElMessageBox.alert(
      `状态：失败\n原因：${msg}\n\n建议：\n1. 云端接口：检查 Key 与余额\n2. Ollama 本地：先执行 ollama serve\n3. 模型不存在：先执行 ollama pull qwen2.5:7b\n4. 若模型权限报错，点击“自动选择可用模型”`,
      'AI 连通性测试结果',
      { confirmButtonText: '我去处理', type: 'error' },
    );
  }
};

const isOllamaMode = () => {
  const s = String(settingsForm.ai_api_base || '').toLowerCase();
  return s.includes('127.0.0.1:11434') || s.includes('localhost:11434');
};

const applyOllamaPreset = async () => {
  settingsForm.ai_api_base = 'http://127.0.0.1:11434/v1';
  settingsForm.ai_host_header = '';
  settingsForm.ai_model = settingsForm.ai_model || 'qwen2.5:7b';
  settingsForm.ai_api_key = '';
  await ElMessageBox.alert(
    '已填充 Ollama 推荐配置：\n- AI Base URL: http://127.0.0.1:11434/v1\n- AI 模型: qwen2.5:7b\n- AI Key: 留空即可\n\n请点击“保存配置（自动备份）”。',
    '已切换到 Ollama 预设',
    { confirmButtonText: '去保存', type: 'success' },
  );
};

const autoSelectModel = async () => {
  try {
    const { data } = await http.post('/admin/settings/ai-auto-select-model', {}, { skipErrorToast: true });
    settingsForm.ai_model = data?.model || settingsForm.ai_model;
    await loadSettings();
    await ElMessageBox.alert(
      `已自动切换到可用模型：${data?.model || '未知'}\n测试返回：${data?.preview || 'ok'}`,
      '自动选择模型成功',
      { confirmButtonText: '好的', type: 'success' },
    );
  } catch (err) {
    const payload = err?.response?.data || {};
    const list = Array.isArray(payload.tried) ? payload.tried : [];
    const details = list.slice(0, 5).map((x) => `- ${x.model}: ${x.error}`).join('\n');
    await ElMessageBox.alert(
      `${payload.message || '自动探测失败'}\n\n已尝试模型：\n${details || '无'}\n\n请先确认 Key 有额度且已开通对应模型权限。`,
      '自动选择模型失败',
      { confirmButtonText: '知道了', type: 'warning' },
    );
  }
};

onMounted(async () => {
  await Promise.all([loadUsers(), loadAnnouncements(), loadUploadPolicy()]);
  if (auth.isAdmin) {
    await Promise.all([loadSettings(), loadBackups(), loadAuditLogs()]);
  }
});
</script>
<style scoped>
.page { display: flex; flex-direction: column; gap: 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.settings-form { margin-top: 12px; }
.small-gap { margin-bottom: 10px; }
.section-toggle { margin-bottom: 8px; }
</style>
