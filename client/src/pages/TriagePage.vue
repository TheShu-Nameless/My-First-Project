<template>
  <div class="page">
    <el-card class="glass-panel">
      <template #header>AI 智能分诊</template>
      <el-input
        v-model="symptom"
        type="textarea"
        :rows="5"
        placeholder="请输入症状，例如：近两日咽痛伴低热、咳嗽、乏力..."
      />
      <div class="actions">
        <el-button type="primary" :loading="loading" @click="run">生成分诊建议</el-button>
      </div>
      <el-result v-if="result" icon="success" title="分诊完成">
        <template #sub-title>
          <div class="result">
            <p><strong>推荐科室：</strong>{{ result.recommended_department }}</p>
            <p><strong>置信度：</strong>{{ result.confidence }}%</p>
            <p><strong>风险等级：</strong>{{ result.risk_level }}</p>
            <p><strong>建议：</strong>{{ result.suggestion }}</p>
            <div class="voice-actions">
              <div class="rate-box">
                <span>播报语速 {{ speechRate.toFixed(2) }}</span>
                <el-slider
                  v-model="speechRate"
                  :min="0.8"
                  :max="1.3"
                  :step="0.05"
                  size="small"
                  :disabled="isSpeaking"
                />
              </div>
              <el-button
                size="small"
                type="primary"
                plain
                :disabled="isSpeaking"
                @click="speakSuggestion"
              >
                重播建议
              </el-button>
              <el-button size="small" :disabled="!isSpeaking" @click="stopSpeaking">停止播报</el-button>
            </div>
          </div>
        </template>
      </el-result>
    </el-card>
    <el-card class="glass-panel">
      <template #header>历史问询记录</template>
      <div class="section-toggle">
        <el-button text type="primary" @click="showHistory = !showHistory">
          {{ showHistory ? '收起历史问询记录' : '展开历史问询记录' }}（{{ history.length }}）
        </el-button>
      </div>
      <el-collapse-transition>
        <div v-show="showHistory">
          <el-table :data="history">
            <el-table-column prop="symptom" label="症状描述" min-width="260" show-overflow-tooltip />
            <el-table-column prop="department_name" label="推荐科室" min-width="120" />
            <el-table-column prop="confidence" label="置信度" min-width="90" />
            <el-table-column prop="suggestion" label="建议" min-width="260" show-overflow-tooltip />
          </el-table>
        </div>
      </el-collapse-transition>
    </el-card>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '@/api/http';

const storage = typeof window !== 'undefined' ? window.localStorage : null;
const SPEECH_RATE_KEY = 'triage_speech_rate';

const getStoredRate = () => {
  const raw = Number(storage?.getItem(SPEECH_RATE_KEY));
  if (!Number.isFinite(raw)) return 0.95;
  return Math.max(0.8, Math.min(1.3, raw));
};

const symptom = ref('');
const result = ref(null);
const history = ref([]);
const showHistory = ref(false);
const loading = ref(false);
const isSpeaking = ref(false);
const speechRate = ref(getStoredRate());
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const audioPlayer = ref(null);
const audioObjectUrl = ref('');
const remoteTtsAvailable = ref(true);
const remoteTtsHintShown = ref(false);
const playbackToken = ref(0);

const speechTextMandarin = computed(() => {
  if (!result.value) return '';
  const suggestion = String(result.value.suggestion || '').trim();
  return suggestion || '建议您前往门诊现场，请医生进一步面诊。';
});

const speechTextXiangshan = computed(() => {
  if (!result.value) return '';
  const suggestion = String(result.value.suggestion || '').trim();
  return suggestion || '阿拉建议侬到门诊现场请医生再看一下。';
});

const stopSpeaking = () => {
  playbackToken.value += 1;
  if (speechSupported) {
    window.speechSynthesis.cancel();
  }
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.src = '';
    audioPlayer.value = null;
  }
  if (audioObjectUrl.value) {
    URL.revokeObjectURL(audioObjectUrl.value);
    audioObjectUrl.value = '';
  }
  isSpeaking.value = false;
};

const isPlaybackCancelled = (token) => token !== playbackToken.value;

const playByBrowserTts = ({ text, lang, token }) => {
  if (!speechSupported) throw new Error('当前浏览器不支持内置语音播报');
  window.speechSynthesis.cancel();
  if (isPlaybackCancelled(token)) return Promise.resolve();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = speechRate.value;
  utterance.pitch = 1;
  return new Promise((resolve, reject) => {
    utterance.onstart = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = true;
    };
    utterance.onend = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = false;
      resolve();
    };
    utterance.onerror = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = false;
      reject(new Error('BROWSER_TTS_FAILED'));
    };
    window.speechSynthesis.speak(utterance);
  });
};

const playByRemoteTts = async ({ text, mode, token }) => {
  if (!remoteTtsAvailable.value) throw new Error('REMOTE_TTS_DISABLED');
  if (isPlaybackCancelled(token)) return;
  const { data } = await http.post(
    '/tts/speak',
    { text, mode, rate: speechRate.value },
    { responseType: 'blob', skipErrorToast: true },
  );
  if (isPlaybackCancelled(token)) return;
  const mimeType = String(data?.type || '');
  if (mimeType.includes('application/json')) {
    const payload = JSON.parse(await data.text());
    throw new Error(payload?.message || '外部语音服务返回异常');
  }
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.src = '';
    audioPlayer.value = null;
  }
  if (audioObjectUrl.value) {
    URL.revokeObjectURL(audioObjectUrl.value);
    audioObjectUrl.value = '';
  }
  const objectUrl = URL.createObjectURL(data);
  audioObjectUrl.value = objectUrl;
  const audio = new Audio(objectUrl);
  audioPlayer.value = audio;
  await new Promise((resolve, reject) => {
    audio.onplay = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = true;
    };
    audio.onended = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = false;
      if (audioPlayer.value === audio) {
        audioPlayer.value = null;
      }
      if (audioObjectUrl.value === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        audioObjectUrl.value = '';
      }
      resolve();
    };
    audio.onerror = () => {
      if (!isPlaybackCancelled(token)) isSpeaking.value = false;
      if (audioPlayer.value === audio) {
        audioPlayer.value = null;
      }
      if (audioObjectUrl.value === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        audioObjectUrl.value = '';
      }
      reject(new Error('REMOTE_TTS_PLAY_FAILED'));
    };
    audio.play().catch(() => reject(new Error('REMOTE_TTS_PLAY_FAILED')));
  });
};

const playSegment = async ({ text, mode, lang, token }) => {
  if (!text) return;
  try {
    await playByRemoteTts({ text, mode, token });
  } catch (remoteError) {
    const msg = String(remoteError?.message || '');
    if (msg === 'PLAYBACK_CANCELLED') return;
    const lowerMsg = msg.toLowerCase();
    const shouldDisableRemote =
      msg.includes('未配置 TTS 接口地址') ||
      msg.includes('REMOTE_TTS_DISABLED') ||
      lowerMsg.includes('invalid api key') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('401');
    if (shouldDisableRemote) {
      remoteTtsAvailable.value = false;
      if (!remoteTtsHintShown.value) {
        ElMessage.info('已切换免Key语音模式（浏览器播报）');
        remoteTtsHintShown.value = true;
      }
    }
    if (!speechSupported) {
      ElMessage.error(`外部语音不可用：${String(remoteError?.message || '服务异常')}`);
      throw remoteError;
    }
    if (!shouldDisableRemote) {
      ElMessage.warning('外部语音暂不可用，已切换浏览器语音播报');
    }
    await playByBrowserTts({ text, lang, token });
  }
};

const speakSuggestion = async () => {
  if (!speechTextMandarin.value && !speechTextXiangshan.value) {
    ElMessage.warning('暂无可播报的分诊建议');
    return;
  }
  stopSpeaking();
  const token = playbackToken.value;
  await playSegment({
    text: speechTextMandarin.value,
    mode: 'mandarin',
    lang: 'zh-CN',
    token,
  });
  if (isPlaybackCancelled(token)) return;
  await playSegment({
    text: speechTextXiangshan.value,
    mode: 'xiangshan',
    lang: 'zh-CN',
    token,
  });
  if (!isPlaybackCancelled(token)) {
    isSpeaking.value = false;
  }
};

const loadHistory = async () => {
  const { data } = await http.get('/inquiries');
  history.value = data.list || [];
};

const run = async () => {
  if (!symptom.value || symptom.value.length < 4) {
    ElMessage.warning('请尽量详细描述症状');
    return;
  }
  stopSpeaking();
  loading.value = true;
  try {
    const { data } = await http.post('/triage', { symptom: symptom.value });
    result.value = data.result;
    await loadHistory();
    await speakSuggestion();
  } finally {
    loading.value = false;
  }
};

onMounted(loadHistory);
onBeforeUnmount(stopSpeaking);
onBeforeRouteLeave(() => {
  stopSpeaking();
});
watch(speechRate, (v) => {
  storage?.setItem(SPEECH_RATE_KEY, String(v));
});
</script>
<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.actions {
  margin-top: 10px;
}

.result {
  text-align: left;
  color: var(--tcm-text);
}

.voice-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.rate-box {
  width: 180px;
  color: var(--tcm-text);
  font-size: 12px;
}

.section-toggle {
  margin-bottom: 8px;
}
</style>
