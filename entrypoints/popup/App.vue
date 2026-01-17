<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, onMounted, ref, watch } from 'vue';
import OdataSniffer from '@/components/OdataSniffer.vue';
import FieldInspector from '@/components/FieldInspector.vue';
import SettingsView from '@/components/SettingsView.vue';
import FeatureCard from '@/components/FeatureCard.vue';
import { type Feature, type FeatureId, type TranslateFn } from '@/types/common';
import {
  getDefaultEnvSettings,
  loadEnvSettings,
  saveEnvSettings,
  type EnvSettings,
  type EnvInstance,
} from '@/utils/env-settings';

const t: TranslateFn = (key, substitutions = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

const features: Feature[] = [
  { id: 'odata', titleKey: 'feature_odata_title', descKey: 'feature_odata_desc', ready: true },
  { id: 'inspector', titleKey: 'feature_inspector_title', descKey: 'feature_inspector_desc', ready: true },
  { id: 'feature3', titleKey: 'feature_future_title', descKey: 'feature_future_desc', ready: false },
];

const activeFeature = ref<'home' | FeatureId>('home');
const pendingFieldId = ref<string | null>(null);
const envSettings = ref<EnvSettings>(getDefaultEnvSettings());
const detectedInstance = ref<EnvInstance | null>(null);
const activeTabId = ref<number | null>(null);

const STORAGE_NAV_PREFIX = 'devmate:nav-state:';

async function hydrateSettings() {
  envSettings.value = await loadEnvSettings();
}

/**
 * Detects the IFS instance and identifies the active tab.
 */
async function detectInstance() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    activeTabId.value = tab?.id ?? null;

    if (!tab?.url) {
      detectedInstance.value = null;
      return;
    }
    const url = new URL(tab.url);
    const host = url.host;
    const fullHref = url.href;

    detectedInstance.value = envSettings.value.find(cfg => {
        if (!cfg.url.trim()) return false;
        try {
            const target = new URL(cfg.url);
            return host === target.host && fullHref.startsWith(target.origin + target.pathname);
        } catch {
            return fullHref.includes(cfg.url.trim());
        }
    }) ?? null;
  } catch {
    detectedInstance.value = null;
  }
}

function openFeature(id: FeatureId) {
  activeFeature.value = id;
}

function goHome() {
  activeFeature.value = 'home';
  void detectInstance();
}

async function handleSaveSettings(newSettings: EnvSettings) {
  envSettings.value = newSettings;
  await saveEnvSettings(newSettings);
  await detectInstance();
  activeFeature.value = 'home';
}

/**
 * Priority 1: Check if the user just picked a field (re-entry from background).
 */
async function checkPendingPickedField(): Promise<boolean> {
  try {
    const result = await browser.runtime.sendMessage({ type: 'devmate:fi-get-picked' });
    if (result && typeof result.fieldId === 'string') {
      pendingFieldId.value = result.fieldId;
      activeFeature.value = 'inspector';
      return true;
    }
  } catch (err) {
    console.warn('Check pending field error', err);
  }
  return false;
}

/**
 * Priority 2: Restore the last manual navigation for this specific tab.
 */
async function restoreNavigationState() {
  if (activeTabId.value === null) return;
  try {
    const key = `${STORAGE_NAV_PREFIX}${activeTabId.value}`;
    const stored = await browser.storage.local.get(key);
    const lastFeature = stored[key] as FeatureId | 'home';
    if (lastFeature && lastFeature !== 'home') {
      activeFeature.value = lastFeature;
    }
  } catch (err) {
    console.warn('Restore navigation error', err);
  }
}


// Persist navigation changes (except pick-mode which has its own sync)
watch(activeFeature, async (newVal) => {
  if (activeTabId.value === null) return;
  const key = `${STORAGE_NAV_PREFIX}${activeTabId.value}`;
  await browser.storage.local.set({ [key]: newVal });
});

onMounted(async () => {
  await hydrateSettings();
  await detectInstance();
  
  // Try specialized re-entry first, then regular persistence
  const wasPicked = await checkPendingPickedField();
  if (!wasPicked) {
    await restoreNavigationState();
  }
});

const environmentStyle = computed(() => {
  const color = detectedInstance.value?.color;
  if (!color) return {};
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}52`,
    color,
  };
});
</script>

<template>
  <main class="popup">
    <template v-if="activeFeature === 'home'">
      <header class="header">
        <div class="header-left">
          <p class="eyebrow">Aurena DevMate</p>
        </div>
        <div class="header-right">
          <span class="badge env" :class="detectedInstance ? 'is-active' : 'is-unknown'" :style="environmentStyle">
            {{ detectedInstance?.name ?? t('instance_label_unknown') }}
          </span>
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            :title="t('settings_title')"
            @click="activeFeature = 'settings'"
          >
            <i class="pi pi-pencil" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <section class="features">
        <FeatureCard 
            v-for="feature in features" 
            :key="feature.id" 
            :feature="feature" 
            :t="t"
            @open="openFeature"
        />
      </section>
    </template>

    <template v-else-if="activeFeature === 'odata'">
      <OdataSniffer show-back @back="goHome" />
    </template>

    <template v-else-if="activeFeature === 'inspector'">
      <FieldInspector show-back :pending-field-id="pendingFieldId" @back="goHome" />
    </template>

    <template v-else-if="activeFeature === 'settings'">
      <SettingsView 
          :initial-settings="envSettings" 
          :t="t"
          @save="handleSaveSettings"
          @cancel="activeFeature = 'home'"
      />
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
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}
.badge.env {
  background: rgba(148, 163, 184, 0.2);
  color: #475569;
  border: 1px solid rgba(148, 163, 184, 0.35);
  letter-spacing: 0.06em;
}
.placeholder {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.placeholder h2 { margin: 0; }
.placeholder-desc { color: #64748b; font-size: 13px; margin: 0; }
</style>
