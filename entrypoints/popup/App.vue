<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, onMounted, ref } from 'vue';
import OdataSniffer from '@/components/OdataSniffer.vue';
import FieldInspector from '@/components/FieldInspector.vue';
import {
  getDefaultEnvSettings,
  loadEnvSettings,
  normalizeUrl,
  saveEnvSettings,
  type EnvSettings,
  type EnvInstance,
} from '@/utils/env-settings';

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

const t = (key: MessageKey, substitutions: Array<string | number> = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

type FeatureId = 'odata' | 'inspector' | 'feature3' | 'settings';
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
    id: 'inspector',
    titleKey: 'feature_inspector_title',
    descKey: 'feature_inspector_desc',
    ready: true,
  },
  {
    id: 'feature3',
    titleKey: 'feature_future_title',
    descKey: 'feature_future_desc',
    ready: false,
  },
];

const activeFeature = ref<'home' | FeatureId>('home');
const pendingFieldId = ref<string | null>(null);

const instanceInfo = ref<{ instance: EnvInstance | null }>({ instance: null });
const envSettings = ref<EnvSettings>(getDefaultEnvSettings());
const draftSettings = ref<EnvSettings>(getDefaultEnvSettings());

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `env-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

async function hydrateSettings() {
  envSettings.value = await loadEnvSettings();
}

function matchInstance(url: URL): EnvInstance | null {
  const href = url.href;
  const host = url.host;

  for (const cfg of envSettings.value) {
    if (!cfg.url.trim()) continue;
    try {
      const target = new URL(cfg.url);
      if (host === target.host && href.startsWith(target.origin + target.pathname)) {
        return cfg;
      }
      if (href.startsWith(target.toString())) return cfg;
    } catch {
      if (href.includes(cfg.url.trim())) return cfg;
    }
  }
  return null;
}

async function detectInstance() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ? new URL(tab.url) : null;
    if (!url) {
      instanceInfo.value = { instance: null };
      return;
    }
    instanceInfo.value = {
      instance: matchInstance(url),
    };
  } catch (err) {
    console.error(err);
    instanceInfo.value = { instance: null };
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

async function checkPendingPickedField() {
  try {
    const result = await browser.runtime.sendMessage({ type: 'devmate:fi-get-picked' });
    if (result && typeof result.fieldId === 'string') {
      pendingFieldId.value = result.fieldId;
      activeFeature.value = 'inspector';
    }
  } catch (err) {
    console.warn('Check pending picked field error', err);
  }
}

onMounted(() => {
  void (async () => {
    await hydrateSettings();
    await detectInstance();
    await checkPendingPickedField();
  })();
});

const environmentClass = computed(() => {
  return instanceInfo.value.instance ? 'env-detected' : 'env-unknown';
});

const environmentStyle = computed(() => {
  const color = instanceInfo.value.instance?.color;
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
  const normalized = (JSON.parse(JSON.stringify(draftSettings.value)) as EnvSettings).map((entry) => ({
    ...entry,
    url: normalizeUrl(entry.url),
  }));
  envSettings.value = normalized;
  await saveEnvSettings(envSettings.value);
  await detectInstance();
  activeFeature.value = 'home';
}

function cancelSettings() {
  draftSettings.value = JSON.parse(JSON.stringify(envSettings.value)) as EnvSettings;
  activeFeature.value = 'home';
}

function addInstance() {
  draftSettings.value = [
    ...draftSettings.value,
    {
      id: generateId(),
      name: `Instance ${draftSettings.value.length + 1}`,
      url: '',
      color: '#4f46e5',
    },
  ];
}

function removeInstance(id: string) {
  if (draftSettings.value.length <= 1) return;
  draftSettings.value = draftSettings.value.filter((item) => item.id !== id);
}

function previewStyle(id: string) {
  const target = draftSettings.value.find((item) => item.id === id);
  const color = target?.color || '#475569';
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
            {{ instanceInfo.instance?.name ?? t('instance_label_unknown') }}
          </span>
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            title="Edit environment settings"
            aria-label="Edit environment settings"
            @click="openSettings"
          >
            <i class="pi pi-pencil" aria-hidden="true"></i>
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
            class="btn"
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

    <template v-else-if="activeFeature === 'inspector'">
      <FieldInspector show-back :pending-field-id="pendingFieldId" @back="goHome" />
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
            v-for="item in draftSettings"
            :key="item.id"
            class="settings-card"
          >
            <div class="settings-card-head">
              <span class="badge env" :style="previewStyle(item.id)">
                {{ item.name || t('instance_label_unknown') }}
              </span>
              <button
                v-if="draftSettings.length > 1"
                type="button"
                class="btn btn--ghost btn--tiny btn--icon remove"
                title="Remove instance"
                aria-label="Remove instance"
                @click="removeInstance(item.id)"
              >
                <i class="pi pi-trash" aria-hidden="true"></i>
              </button>
            </div>
            <label class="field">
              <span class="label">{{ t('settings_name_label') }}</span>
              <input
                v-model="item.name"
                type="text"
                :placeholder="t('settings_name_placeholder')"
              />
            </label>
            <label class="field">
              <span class="label">{{ t('settings_url_label') }}</span>
              <input
                v-model="item.url"
                type="text"
                :placeholder="t('settings_url_placeholder')"
              />
            </label>
            <label class="field color-field">
              <span class="label">{{ t('settings_color_label') }}</span>
              <input v-model="item.color" type="color" />
              <input v-model="item.color" type="text" class="color-text" />
            </label>
          </div>
        </div>

        <div class="settings-actions gap">
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            title="Add instance"
            aria-label="Add instance"
            @click="addInstance"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
          </button>
        </div>

        <p class="helper">{{ t('settings_helper') }}</p>

        <div class="settings-actions">
          <button type="button" class="btn btn--ghost" @click="cancelSettings">{{ t('button_cancel') }}</button>
          <button type="button" class="btn" @click="saveSettings">{{ t('button_save') }}</button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="placeholder">
        <p class="eyebrow">{{ t('home_eyebrow') }}</p>
        <h2>{{ t('placeholder_title') }}</h2>
        <p class="placeholder-desc">{{ t('placeholder_desc') }}</p>
        <button type="button" class="btn btn--ghost" @click="goHome">
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
.badge.env.env-detected {
  background: rgba(79, 70, 229, 0.08);
  color: #312e81;
  border: 1px solid rgba(79, 70, 229, 0.16);
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
.settings-card .remove {
  padding: 6px 8px;
  font-size: 12px;
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
.settings-actions.gap {
  justify-content: flex-start;
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
