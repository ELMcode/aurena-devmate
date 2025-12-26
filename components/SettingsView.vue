<script lang="ts" setup>
import { ref } from 'vue';
import { type EnvSettings, normalizeUrl } from '@/utils/env-settings';
import { type TranslateFn } from '@/types/common';

const props = defineProps<{
  initialSettings: EnvSettings;
  t: TranslateFn;
}>();

const emit = defineEmits<{
  (e: 'save', settings: EnvSettings): void;
  (e: 'cancel'): void;
}>();

const draftSettings = ref<EnvSettings>(JSON.parse(JSON.stringify(props.initialSettings)));

function generateId() {
  return crypto.randomUUID 
    ? crypto.randomUUID() 
    : `env-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
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

function handleSave() {
  const normalized = draftSettings.value.map((entry) => ({
    ...entry,
    url: normalizeUrl(entry.url),
  }));
  emit('save', normalized);
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
      <div v-for="item in draftSettings" :key="item.id" class="settings-card">
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
      <button type="button" class="btn btn--ghost" @click="emit('cancel')">{{ t('button_cancel') }}</button>
      <button type="button" class="btn" @click="handleSave">{{ t('button_save') }}</button>
    </div>
  </section>
</template>

<style scoped>
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
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}
.badge.env {
  background: rgba(79, 70, 229, 0.08);
  color: #312e81;
  border: 1px solid rgba(79, 70, 229, 0.16);
  letter-spacing: 0.06em;
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
input[type='text'] {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  font-size: 13px;
}
input[type='color'] {
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
</style>
