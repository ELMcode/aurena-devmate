<script lang="ts" setup>
import { computed } from 'vue';
import { type EnhancedRequest } from '@/types/odata';
import { type TranslateFn } from '@/types/common';
import { escapeHtml } from '@/utils/odata-helpers';

const props = defineProps<{
  req: EnhancedRequest;
  isExpanded: boolean;
  t: TranslateFn;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'copy', text: string, label: string): void;
}>();

const statusClass = computed(() => {
  const code = props.req.statusCode;
  if (!code) return '';
  if (code >= 200 && code < 300) return 'status--success';
  if (code >= 400 && code < 500) return 'status--warning';
  if (code >= 500) return 'status--error';
  return '';
});

/**
 * Highlighting logic for custom fields within OData fragments.
 */
function highlightCustomFields(req: EnhancedRequest, value?: string) {
  if (!value) return '';
  const escaped = escapeHtml(value);
  if (!req.highlightRegex) return escaped;
  return escaped.replace(req.highlightRegex, '<span class="custom-highlight">$1</span>');
}
</script>

<template>
  <article class="card">
    <div class="card-head">
      <div class="top-row">
        <div class="left">
          <span class="badge method">{{ req.method }}</span>
          <span v-if="req.statusCode" :class="['badge', statusClass]">{{ req.statusCode }}</span>
          <span class="code target" v-html="highlightCustomFields(req, req.target)"></span>
          <span v-if="req.hasCustomFields" class="badge custom">{{ t('badge_custom_fields') }}</span>
        </div>
        <button type="button" class="btn btn--ghost btn--tiny btn--icon" @click="emit('toggle')">
          <i :class="['pi', isExpanded ? 'pi-chevron-up' : 'pi-chevron-down']" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="details">
      <div class="row kv">
        <div>
          <span class="label">{{ t('label_projection') }}</span>
          <span class="value">{{ req.projection || t('label_unknown_projection') }}</span>
        </div>
        <div>
          <span class="label">{{ t('label_endpoint') }}</span>
          <span class="value monospace" v-html="highlightCustomFields(req, req.url)"></span>
        </div>
      </div>
      
      <div v-if="req.customFields.length" class="custom-field-list">
        <span class="label">{{ t('custom_fields_section') }}</span>
        <div class="chip-row">
          <span v-for="field in req.customFields" :key="field" class="chip">{{ field }}</span>
        </div>
      </div>

      <div v-if="req.odata" class="params">
        <div v-if="req.odata.filter">
          <strong>$filter</strong>
          <span v-html="highlightCustomFields(req, req.odata.filter)"></span>
        </div>
        <div v-if="req.odata.select">
          <strong>$select</strong>
          <span v-html="highlightCustomFields(req, req.odata.select)"></span>
        </div>
        <div v-if="req.odata.expand">
          <strong>$expand</strong>
          <span v-html="highlightCustomFields(req, req.odata.expand)"></span>
        </div>
        <div v-if="req.odata.orderby">
          <strong>$orderby</strong>
          <span v-html="highlightCustomFields(req, req.odata.orderby)"></span>
        </div>
        <div v-if="req.odata.top"><strong>$top</strong> {{ req.odata.top }}</div>
        <div v-if="req.odata.skip"><strong>$skip</strong> {{ req.odata.skip }}</div>
      </div>
    </div>

    <div class="row actions-row">
      <button type="button" class="btn btn--ghost btn--tiny" @click="emit('copy', req.url, 'url')">
        {{ t('button_copy_url') }}
      </button>
      <button type="button" class="btn btn--ghost btn--tiny" @click="emit('copy', req.curl, 'curl')">
        {{ t('button_copy_curl') }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid rgba(79, 70, 229, 0.08);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  word-break: break-word;
}
.card-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  padding-bottom: 6px;
}
.top-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.top-row .left {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.badge {
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}
.badge.method {
  background: #eef2ff;
  color: #4338ca;
}
.badge.custom {
  background: rgba(236, 72, 153, 0.1);
  color: #be185d;
  border: 1px solid rgba(236, 72, 153, 0.2);
}
.status--success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.status--warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.2);
}
.status--error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #1e1b4b;
}
.code.target {
  display: block;
  width: 100%;
  word-break: break-word;
  margin-top: 4px;
}
.details {
  margin-top: 8px;
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.kv {
  justify-content: space-between;
}
.label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
}
.value {
  display: block;
  font-size: 12px;
  color: #0f172a;
}
.monospace {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  word-break: break-all;
}
.params {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  font-size: 12px;
  color: #334155;
  margin-top: 6px;
}
.params strong {
  color: #4338ca;
  margin-right: 4px;
}
.custom-field-list {
  margin-top: 8px;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.chip {
  background: rgba(236, 72, 153, 0.12);
  color: #be185d;
  border: 1px solid rgba(236, 72, 153, 0.2);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}
:deep(.custom-highlight) {
  color: #b91c1c !important;
  font-weight: 700;
}
.actions-row {
  margin-top: 8px;
  gap: 6px;
}
</style>
