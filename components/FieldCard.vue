<script lang="ts" setup>
import { computed } from 'vue';
import type { FieldInfo, MessageKey } from '@/types/inspector';

const props = defineProps<{
  field: FieldInfo;
  isSelected: boolean;
  t: (key: MessageKey, substitutions?: Array<string | number>) => string;
  baseUrl: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'highlight', id: string): void;
  (e: 'leave', id: string): void;
  (e: 'open-external', url: string): void;
}>();

// --- Action URL Builders ---

function encodeFilter(filter: string) {
  return filter.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

const translationUrl = computed(() => {
  if (!props.baseUrl || !props.field.meta?.translationKey) return null;
  const path = props.field.meta.translationKey.trim().toLowerCase();
  const filter = encodeFilter(`(startswith(tolower(Path),'${path}'))`);
  return `${props.baseUrl}/web/page/TranslatableFields/List;$filter=${filter}`;
});

function getEntityUrl(entity: string) {
  if (!props.baseUrl || !entity) return null;
  const path = entity.trim().toLowerCase();
  const filter = encodeFilter(`(startswith(tolower(LuName),'${path}'))`);
  return `${props.baseUrl}/web/page/Entity/Form;$filter=${filter}`;
}

function getEntityConfigUrl(entity: string) {
  if (!props.baseUrl || !entity) return null;
  const path = entity.trim().toLowerCase();
  const filter = encodeFilter(`(startswith(tolower(Lu),'${path}'))`);
  return `${props.baseUrl}/web/page/EntityConfigHandling/CustomAttributesDetail;$filter=${filter}`;
}
</script>

<template>
  <article
    class="card"
    :class="{ selected: isSelected }"
    :data-fi-id="field.id"
    @click="emit('select', field.id)"
    @mouseenter="emit('highlight', field.id)"
    @mouseleave="emit('leave', field.id)"
  >
    <header class="card-head">
      <div>
        <p class="label">
          {{ field.meta?.label || field.label || t('fi_label_unknown') }}
        </p>
        <p class="sub">
          {{ field.meta?.control || field.tag }}
          <span v-if="field.type"> · {{ field.type }}</span>
        </p>
      </div>
      <div class="badges">
        <span v-if="isSelected" class="badge tiny success">
          <i class="pi pi-check" aria-hidden="true"></i> Selected
        </span>
        <span v-if="field.custom || field.meta?.custom" class="badge tiny warning">
          {{ t('fi_meta_custom') }}
        </span>
        <span v-if="field.meta?.isStructure" class="badge tiny neutral">
          {{ t('fi_meta_structure') }}
        </span>
        <span v-if="field.meta?.isLov" class="badge tiny neutral">
          {{ t('fi_meta_lov_tag') }}
        </span>
      </div>
    </header>

    <div class="rows">
      <!-- Main Metadata -->
      <div class="row" v-if="field.meta?.attribute">
        <span class="key">{{ t('fi_meta_attribute') }}</span>
        <span class="value monospace">{{ field.meta.attribute }}</span>
      </div>
      
      <div class="row" v-if="field.meta?.name">
        <span class="key">{{ t('fi_meta_reference') }}</span>
        <span class="value monospace">{{ field.meta.name }}</span>
      </div>

      <!-- Entity & Configuration -->
      <div class="row" v-if="field.meta?.entity">
        <span class="key">{{ t('fi_meta_entity') }}</span>
        <span class="value monospace">
          {{ field.meta.entity }}
          <span class="action-links" v-if="!field.meta.isLov && !field.meta.isStructure">
            <button
              v-if="getEntityUrl(field.meta.entity)"
              type="button"
              class="btn btn--ghost btn--icon action-btn"
              :title="t('fi_entity_open')"
              @click.stop="emit('open-external', getEntityUrl(field.meta.entity)!)"
            >
              <i class="pi pi-external-link"></i>
            </button>
            <button
              v-if="getEntityConfigUrl(field.meta.entity)"
              type="button"
              class="btn btn--ghost btn--icon action-btn"
              :title="t('fi_entity_config_open')"
              @click.stop="emit('open-external', getEntityConfigUrl(field.meta.entity)!)"
            >
              <i class="pi pi-cog"></i>
            </button>
          </span>
        </span>
      </div>

      <div class="row" v-if="field.meta?.entitySet">
        <span class="key">{{ t('fi_meta_entityset') }}</span>
        <span class="value monospace">{{ field.meta.entitySet }}</span>
      </div>

      <div class="row" v-if="field.meta?.view">
        <span class="key">{{ t('fi_meta_view') }}</span>
        <span class="value monospace">{{ field.meta.view }}</span>
      </div>

      <!-- Parent / Context info -->
      <div class="row" v-if="field.meta?.parentEntity">
        <span class="key">{{ t('fi_meta_parent') }}</span>
        <span class="value monospace">
          {{ field.meta.parentEntity }}
          <span class="action-links">
            <button
              v-if="getEntityUrl(field.meta.parentEntity)"
              type="button"
              class="btn btn--ghost btn--icon action-btn"
              @click.stop="emit('open-external', getEntityUrl(field.meta.parentEntity)!)"
            >
              <i class="pi pi-external-link"></i>
            </button>
          </span>
        </span>
      </div>

      <!-- Technical Context -->
      <div class="row" v-if="field.meta?.projection">
        <span class="key">{{ t('label_projection') }}</span>
        <span class="value monospace">{{ field.meta.projection }}</span>
      </div>

      <!-- Translation & LOV -->
      <div class="row" v-if="field.meta?.translationKey">
        <span class="key">{{ t('fi_meta_translation') }}</span>
        <span class="value monospace">
          {{ field.meta.translationKey }}
          <button
            v-if="translationUrl"
            type="button"
            class="btn btn--ghost btn--icon action-btn"
            @click.stop="emit('open-external', translationUrl!)"
          >
            <i class="pi pi-external-link"></i>
          </button>
        </span>
      </div>

      <div class="row" v-if="field.meta?.lov">
        <span class="key">{{ t('fi_meta_lov') }}</span>
        <span class="value monospace">{{ field.meta.lov }}</span>
      </div>

      <!-- Other Attributes -->
      <div class="row" v-if="typeof field.meta?.required === 'boolean'">
        <span class="key">{{ t('fi_meta_required') }}</span>
        <span class="value monospace">{{ field.meta.required ? t('common_yes') : t('common_no') }}</span>
      </div>

      <div class="row" v-if="field.placeholder">
        <span class="key">{{ t('fi_placeholder') }}</span>
        <span class="value monospace">{{ field.placeholder }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid rgba(79, 70, 229, 0.12);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.06);
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  cursor: pointer;
}
.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
}
.card.selected {
  border-color: #f97316;
  background: #fffaf5;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);
  transform: translateY(-2px);
}
.card.selected .label { color: #c2410c; }

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.label { margin: 0; font-weight: 600; color: #0f172a; }
.sub { margin: 2px 0 0; color: #64748b; font-size: 12px; }

.badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.badge.tiny {
  font-size: 11px; padding: 4px 8px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.04); color: #475569; border: 1px solid rgba(15, 23, 42, 0.08);
}
.badge.success { background: rgba(34, 197, 94, 0.1); color: #15803d; border-color: rgba(34, 197, 94, 0.2); }
.badge.warning { background: rgba(239, 68, 68, 0.1); color: #991b1b; border-color: rgba(239, 68, 68, 0.2); }
.badge.neutral { background: rgba(15, 23, 42, 0.04); color: #475569; border-color: rgba(15, 23, 42, 0.16); }

.rows { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; gap: 6px; }
.key { min-width: 120px; font-size: 12px; color: #94a3b8; }
.value { flex: 1; font-size: 12px; color: #0f172a; word-break: break-word; }
.monospace { font-family: ui-monospace, monospace; }

.action-links { display: inline-flex; gap: 6px; margin-left: 8px; }
.action-btn { width: 24px; height: 24px; }
.action-btn i { font-size: 12px; }

.card.pulse { animation: pulse-highlight 1.2s ease-out; }
@keyframes pulse-highlight {
  0% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.4); transform: scale(1.01); }
  50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.2); }
  100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); transform: scale(1); }
}
</style>
