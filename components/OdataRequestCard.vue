<script lang="ts" setup>
import { computed, ref } from 'vue';
import { type EnhancedRequest } from '@/types/odata';
import { type TranslateFn } from '@/types/common';
import { escapeHtml, highlightOData } from '@/utils/odata-helpers';

const props = defineProps<{
  req: EnhancedRequest;
  isExpanded: boolean;
  t: TranslateFn;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'copy', text: string, label: string): void;
}>();

const showAllSelect = ref(false);
const showFullUrl = ref(false);

const selectFields = computed(() => {
  const select = props.req.odata?.select;
  if (!select) return [];
  return select.split(',').map((f) => f.trim()).filter(Boolean);
});

const displayedSelectFields = computed(() => {
  if (showAllSelect.value) return selectFields.value;
  return selectFields.value.slice(0, 15);
});

const hasHiddenSelects = computed(() => selectFields.value.length > 15);

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

/**
 * Combined highlighting for OData syntax and custom fields.
 */
function formatOData(req: EnhancedRequest, value?: string) {
  if (!value) return '';
  let html = highlightOData(value);
  if (req.highlightRegex) {
    html = html.replace(req.highlightRegex, '<span class="custom-highlight">$1</span>');
  }
  return html;
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
          <div :class="['value-container', { 'is-truncated': !showFullUrl }]">
            <span class="value monospace" v-html="highlightCustomFields(req, req.url)"></span>
          </div>
          <button 
            v-if="req.url.length > 60"
            type="button" 
            class="btn-link btn--tiny"
            @click="showFullUrl = !showFullUrl"
          >
            {{ showFullUrl ? t('button_show_less') : t('button_show_more') }}
          </button>
        </div>
      </div>
      
      <div v-if="req.customFields.length" class="custom-field-list">
        <span class="label">{{ t('custom_fields_section') }}</span>
        <div class="chip-row">
          <span v-for="field in req.customFields" :key="field" class="chip">{{ field }}</span>
        </div>
      </div>

      <div v-if="req.odata" class="params">
        <div v-if="req.odata.filter" class="param-row">
          <span class="odata-key">$filter</span>
          <div class="param-content" v-html="formatOData(req, req.odata.filter)"></div>
        </div>
        <div v-if="req.odata.expand" class="param-row">
          <span class="odata-key">$expand</span>
          <div class="param-content" v-html="formatOData(req, req.odata.expand)"></div>
        </div>
        <div v-if="selectFields.length" class="param-row">
          <span class="odata-key">$select</span>
          <div class="param-content">
            <div class="select-chips">
              <span v-for="field in displayedSelectFields" :key="field" class="select-chip" v-html="formatOData(req, field)"></span>
              <button 
                v-if="hasHiddenSelects" 
                type="button" 
                class="btn-show-more"
                @click="showAllSelect = !showAllSelect"
              >
                {{ showAllSelect ? t('button_show_less') : t('button_show_more_count', [selectFields.length - 15]) }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="req.odata.orderby" class="param-row">
          <span class="odata-key">$orderby</span>
          <div class="param-content" v-html="formatOData(req, req.odata.orderby)"></div>
        </div>
        <div v-if="req.odata.top" class="param-row">
          <span class="odata-key">$top</span>
          <div class="param-content odata-value--number">{{ req.odata.top }}</div>
        </div>
        <div v-if="req.odata.skip" class="param-row">
          <span class="odata-key">$skip</span>
          <div class="param-content odata-value--number">{{ req.odata.skip }}</div>
        </div>
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  margin-top: 8px;
}
.param-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.param-content {
  background: #f8fafc;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #f1f5f9;
  word-break: break-all;
  line-height: 1.4;
}
.odata-key {
  color: #4338ca;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.select-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.select-chip {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
}
.btn-show-more {
  background: none;
  border: none;
  color: #4338ca;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 1px 6px;
}
.btn-show-more:hover {
  text-decoration: underline;
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
.value-container {
  display: block;
}
.value-container.is-truncated {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.btn-link {
  background: none;
  border: none;
  color: #4338ca;
  padding: 0;
  margin-top: 2px;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
}
.btn-link:hover {
  text-decoration: underline;
}
:deep(.custom-highlight) {
  color: #ec4899 !important;
  font-weight: 700;
  text-decoration: underline;
}

/* OData Syntax Highlighting */
:deep(.odata-key) {
  color: #4338ca;
  font-weight: 700;
}
:deep(.odata-operator) {
  color: #ef4444;
  font-weight: 600;
}
:deep(.odata-func) {
  color: #0891b2;
  font-weight: 600;
}
:deep(.odata-value--string) {
  color: #059669;
}
:deep(.odata-value--number) {
  color: #d97706;
}
:deep(.odata-value--boolean) {
  color: #7c3aed;
  font-weight: 600;
}
.actions-row {
  margin-top: 8px;
  gap: 6px;
}
</style>
