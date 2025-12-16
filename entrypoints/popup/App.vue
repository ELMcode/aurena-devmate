<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, onMounted, ref } from 'vue';
import OdataSniffer from '@/components/OdataSniffer.vue';
import {
  getDefaultEnvSettings,
  loadEnvSettings,
  normalizeUrl,
  saveEnvSettings,
  type EnvSettings,
  type Environment,
} from '@/utils/env-settings';

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

const t = (key: MessageKey, substitutions: Array<string | number> = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

type FeatureId = 'odata' | 'feature2' | 'feature3' | 'settings';
type Feature = {
  id: FeatureId;
  titleKey: MessageKey;
  descKey: MessageKey;
  ready: boolean;
};

const features: Feature[] = [
  {
    id: 'odata',
    titleKey: 'feature_odata_title',
    descKey: 'feature_odata_desc',
    ready: true,
  },
  {
    id: 'feature2',
    titleKey: 'feature_future_title',
    descKey: 'feature_future_desc',
    ready: false,
  },
  {
    id: 'feature3',
    titleKey: 'feature_future_title',
    descKey: 'feature_future_desc',
    ready: false,
  },
];

const activeFeature = ref<'home' | FeatureId>('home');

const instanceInfo = ref<{ environment: Environment | null }>({ environment: null });
const envSettings = ref<EnvSettings>(getDefaultEnvSettings());
const draftSettings = ref<EnvSettings>(getDefaultEnvSettings());

async function hydrateSettings() {
  envSettings.value = await loadEnvSettings();
}

function matchEnvironment(url: URL): Environment | null {
  const href = url.href;
  const host = url.host;

  for (const env of Object.keys(envSettings.value) as Environment[]) {
    const cfg = envSettings.value[env];
    if (!cfg.url.trim()) continue;
    try {
      const target = new URL(cfg.url);
      if (host === target.host && href.startsWith(target.origin + target.pathname)) {
        return env;
      }
      if (href.startsWith(target.toString())) return env;
    } catch {
      if (href.includes(cfg.url.trim())) return env;
    }
  }
  return null;
}

async function detectInstance() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? new URL(tab.url) : null;
    if (!url) {
      instanceInfo.value = { environment: null };
      return;
    }
    instanceInfo.value = {
      environment: matchEnvironment(url),
    };
  } catch (err) {
    console.error(err);
    instanceInfo.value = { environment: null };
  }
}

function openFeature(id: FeatureId) {
  const feature = features.find((f) => f.id === id);
  if (!feature?.ready) return;
  activeFeature.value = id;
}

function goHome() {
  activeFeature.value = 'home';
  void detectInstance();
}

onMounted(() => {
  void (async () => {
    await hydrateSettings();
    await detectInstance();
  })();
});

const environmentClass = computed(() => {
  const env = instanceInfo.value.environment;
  return env ? `env-${env.toLowerCase()}` : 'env-unknown';
});

const environmentStyle = computed(() => {
  const env = instanceInfo.value.environment;
  if (!env) return {};
  const color = envSettings.value[env]?.color;
  if (!color) return {};

  const hex = color.replace('#', '');
  if (![3, 6].includes(hex.length)) return {};

  const parseHex = (value: string) =>
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  const normalized = parseHex(hex);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const withAlpha = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

  return {
    backgroundColor: withAlpha(0.14),
    borderColor: withAlpha(0.32),
    color,
  };
});

function openSettings() {
  draftSettings.value = JSON.parse(JSON.stringify(envSettings.value)) as EnvSettings;
  activeFeature.value = 'settings';
}

async function saveSettings() {
  const normalized = JSON.parse(JSON.stringify(draftSettings.value)) as EnvSettings;
  (Object.keys(normalized) as Environment[]).forEach((key) => {
    normalized[key].url = normalizeUrl(normalized[key].url);
  });
  envSettings.value = normalized;
  await saveEnvSettings(envSettings.value);
  await detectInstance();
  activeFeature.value = 'home';
}

function cancelSettings() {
  draftSettings.value = JSON.parse(JSON.stringify(envSettings.value)) as EnvSettings;
  activeFeature.value = 'home';
}

const envList = computed<Environment[]>(() => ['PROD', 'UAT', 'CFG', 'DEV']);

function previewStyle(env: Environment) {
  const color = draftSettings.value[env]?.color || '#475569';
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}55`,
    color,
  };
}
</script>

<template>
  <main class="popup">
    <template v-if="activeFeature === 'home'">
      <header class="header">
        <div class="header-left">
          <p class="eyebrow">Aurena DevMate</p>
        </div>
        <div class="header-right">
          <span class="badge env" :class="environmentClass" :style="environmentStyle">
            {{ instanceInfo.environment ?? t('instance_label_unknown') }}
          </span>
          <button type="button" class="icon ghost" title="Edit environment settings" @click="openSettings">
            ✏️
          </button>
        </div>
      </header>

      <section class="features">
        <article
          v-for="feature in features"
          :key="feature.id"
          class="feature-card"
          :class="{ disabled: !feature.ready }"
        >
          <div class="feature-head">
            <h3>{{ t(feature.titleKey) }}</h3>
            <span class="badge" :class="feature.ready ? 'live' : 'soon'">
              {{ feature.ready ? t('feature_badge_live') : t('feature_badge_soon') }}
            </span>
          </div>
          <p class="feature-desc">{{ t(feature.descKey) }}</p>
          <button
            type="button"
            :disabled="!feature.ready"
            @click="openFeature(feature.id)"
          >
            {{ feature.ready ? t('button_open_feature') : t('feature_coming_soon') }}
          </button>
        </article>
      </section>
    </template>

    <template v-else-if="activeFeature === 'odata'">
      <OdataSniffer show-back @back="goHome" />
    </template>

    <template v-else-if="activeFeature === 'settings'">
      <section class="settings">
        <header class="settings-head">
          <div>
            <p class="eyebrow">{{ t('settings_eyebrow') }}</p>
            <h2 class="settings-title">{{ t('settings_title') }}</h2>
            <p class="settings-desc">
              {{ t('settings_desc') }}
            </p>
          </div>
        </header>

        <div class="settings-grid">
          <div
            v-for="env in envList"
            :key="env"
            class="settings-card"
          >
            <div class="settings-card-head">
              <span class="badge env" :style="previewStyle(env)">
                {{ env }}
              </span>
            </div>
            <label class="field">
              <span class="label">{{ t('settings_url_label') }}</span>
              <input
                v-model="draftSettings[env].url"
                type="text"
                :placeholder="t('settings_url_placeholder')"
              />
            </label>
            <label class="field color-field">
              <span class="label">{{ t('settings_color_label') }}</span>
              <input v-model="draftSettings[env].color" type="color" />
              <input v-model="draftSettings[env].color" type="text" class="color-text" />
            </label>
          </div>
        </div>

        <p class="helper">{{ t('settings_helper') }}</p>

        <div class="settings-actions">
          <button type="button" class="ghost" @click="cancelSettings">{{ t('button_cancel') }}</button>
          <button type="button" @click="saveSettings">{{ t('button_save') }}</button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="placeholder">
        <p class="eyebrow">{{ t('home_eyebrow') }}</p>
        <h2>{{ t('placeholder_title') }}</h2>
        <p class="placeholder-desc">{{ t('placeholder_desc') }}</p>
        <button type="button" class="ghost" @click="goHome">
          {{ t('button_back_home') }}
        </button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.popup * {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: transparent;
}

.popup {
  min-width: 520px;
  max-width: 620px;
  padding: 18px;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #0f172a;
  background: linear-gradient(135deg, #f8fafc, #eef2ff);
  border-radius: 16px;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  margin: 0;
  color: #94a3b8;
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.feature-card {
  border: 1px solid rgba(79, 70, 229, 0.08);
  border-radius: 12px;
  padding: 14px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.feature-card.disabled {
  opacity: 0.7;
}
.feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.feature-head h3 {
  margin: 0;
  font-size: 15px;
}
.feature-desc {
  margin: 0;
  color: #475569;
  font-size: 13px;
  min-height: 40px;
}
button {
  border-radius: 8px;
  border: none;
  padding: 8px 12px;
  font-size: 12px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.2);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}
button.ghost {
  background: rgba(79, 70, 229, 0.08);
  color: #4f46e5;
  box-shadow: none;
}
button:hover:enabled {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(79, 70, 229, 0.25);
}
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}
.badge.live {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.badge.soon {
  background: rgba(236, 72, 153, 0.12);
  color: #be185d;
  border: 1px solid rgba(236, 72, 153, 0.2);
}
.badge.env {
  background: rgba(79, 70, 229, 0.08);
  color: #312e81;
  border: 1px solid rgba(79, 70, 229, 0.16);
  letter-spacing: 0.06em;
}
.badge.env.env-prod {
  background: rgba(59, 130, 246, 0.16);
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.32);
}
.badge.env.env-uat {
  background: rgba(236, 72, 153, 0.1);
  color: #be185d;
  border-color: rgba(236, 72, 153, 0.2);
}
.badge.env.env-cfg {
  background: rgba(234, 179, 8, 0.18);
  color: #854d0e;
  border-color: rgba(234, 179, 8, 0.32);
}
.badge.env.env-dev {
  background: rgba(79, 70, 229, 0.14);
  color: #4338ca;
  border-color: rgba(79, 70, 229, 0.28);
}
.badge.env.env-unknown {
  background: rgba(148, 163, 184, 0.2);
  color: #475569;
  border-color: rgba(148, 163, 184, 0.35);
}
.settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.settings-head .settings-title {
  margin: 4px 0;
}
.settings-desc {
  margin: 0;
  color: #475569;
  font-size: 13px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.settings-card {
  border: 1px solid rgba(79, 70, 229, 0.12);
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.settings-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 12px;
  color: #94a3b8;
}
.settings input[type='text'] {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
}
.settings input[type='color'] {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px;
  width: 46px;
  height: 32px;
  cursor: pointer;
}
.color-field {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.color-text {
  flex: 1;
}
.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.helper {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}
.placeholder {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.placeholder h2 {
  margin: 0;
}
.placeholder-desc {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}
</style>
