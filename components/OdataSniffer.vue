<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, onMounted, ref } from 'vue';

type UiRequest = {
  id: string;
  method: string;
  url: string;
  projection?: string;
  resource?: string;
  odata?: {
    filter?: string;
    select?: string;
    orderby?: string;
    expand?: string;
    top?: string;
    skip?: string;
    raw: Record<string, string>;
  };
  statusCode?: number;
  time: number;
  curl: string;
};

type EnhancedRequest = UiRequest & {
  when: string;
  target: string;
  hasCustomFields: boolean;
  customFields: string[];
  highlightRegex?: RegExp | null;
  openApiUrl?: string | null;
};

const PROJECTION_MARKER = '/ifsapplications/projection/v1/';

const props = defineProps<{ showBack?: boolean }>();
const emit = defineEmits<{ (e: 'back'): void }>();

const tabId = ref<number | null>(null);
const requests = ref<UiRequest[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref('');
const expanded = ref(new Set<string>());
const collapsedProjections = ref(new Set<string>());

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

const t = (key: MessageKey, substitutions: Array<string | number> = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

const totalRequests = computed(() => requests.value.length);

function buildOpenApiUrl(req: UiRequest): string | null {
  if (!req.projection) return null;
  const markerIndex = req.url.indexOf(PROJECTION_MARKER);
  if (markerIndex === -1) return null;
  const base = req.url.slice(0, markerIndex + PROJECTION_MARKER.length);
  return `${base}${req.projection}.svc/$openapi`;
}

async function resolveActiveTab() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId.value = tab?.id ?? null;
  } catch (err) {
    error.value = t('error_active_tab');
    console.error(err);
  }
}

async function refreshRequests() {
  if (tabId.value === null) return;
  loading.value = true;
  try {
    const data = await browser.runtime.sendMessage({ type: 'getRequests', tabId: tabId.value });
    requests.value = Array.isArray(data) ? data : [];
  } catch (err) {
    error.value = t('error_get_requests');
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function clearRequests() {
  if (tabId.value === null) return;
  try {
    const data = await browser.runtime.sendMessage({ type: 'clearRequests', tabId: tabId.value });
    requests.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error(`Clipboard error (${label})`, err);
  }
}

async function openDocsByUrl(url?: string | null) {
  if (!url) return;
  try {
    const viewerUrl = `${browser.runtime.getURL('/openapi-viewer.html')}?spec=${encodeURIComponent(url)}`;
    await browser.tabs.create({ url: viewerUrl });
  } catch (err) {
    console.error('Open docs error', err);
  }
}

function toggleDetails(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function isExpanded(id: string) {
  return expanded.value.has(id);
}

function toggleProjection(name: string) {
  const next = new Set(collapsedProjections.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  collapsedProjections.value = next;
}

function isProjectionCollapsed(name: string) {
  return collapsedProjections.value.has(name);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightCustomFields(req: EnhancedRequest, value?: string) {
  if (!value) return '';
  const escaped = escapeHtml(value);
  if (!req.highlightRegex) return escaped;
  return escaped.replace(req.highlightRegex, '<span class="custom-highlight">$1</span>');
}

const enhancedRequests = computed<EnhancedRequest[]>(() => {
  const q = searchTerm.value.trim().toLowerCase();
  return requests.value
    .map((req) => {
      const when = new Date(req.time).toLocaleTimeString();
      const target = req.resource || req.url.split('/').slice(-1)[0];
      const concat = [req.url, req.odata?.select, req.odata?.filter, req.odata?.expand]
        .filter(Boolean)
        .join(' ');
      const customFieldMatches = concat.match(/cf[_$][a-z0-9_]+/gi) ?? [];
      const customFields = Array.from(new Set(customFieldMatches.map((f) => f)));
      const hasCustomFields = customFields.length > 0;
      const highlightRegex = hasCustomFields
        ? new RegExp(`(${customFields.map(escapeRegex).join('|')})`, 'gi')
        : null;
      return {
        ...req,
        when,
        target,
        hasCustomFields,
        customFields,
        highlightRegex,
        openApiUrl: buildOpenApiUrl(req),
      };
    })
    .filter((req) => {
      if (!q) return true;
      const haystack = [
        req.projection,
        req.resource,
        req.method,
        req.url,
        req.odata?.filter,
        req.odata?.select,
        req.odata?.expand,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
});

const groupedRequests = computed(() => {
  const groups = new Map<
    string,
    { items: EnhancedRequest[]; openApiUrl?: string | null }
  >();
  enhancedRequests.value.forEach((req) => {
    const key = req.projection ?? t('label_unknown_projection');
    const entry = groups.get(key) ?? { items: [], openApiUrl: undefined };
    entry.items.push(req);
    if (!entry.openApiUrl && req.openApiUrl) entry.openApiUrl = req.openApiUrl;
    groups.set(key, entry);
  });
  return Array.from(groups.entries()).map(([projection, data]) => ({
    projection,
    items: data.items,
    openApiUrl: data.openApiUrl,
  }));
});

const filteredCount = computed(() => enhancedRequests.value.length);

const formattedEmptyMessage = computed(() => {
  if (!totalRequests.value) return t('empty_tab_none');
  if (searchTerm.value.trim()) return t('empty_filter_none');
  return t('empty_tab_stored');
});

onMounted(async () => {
  await resolveActiveTab();
  await refreshRequests();
});
</script>

<template>
  <div class="sniffer">
    <header class="header">
      <div>
        <p class="eyebrow">{{ t('app_eyebrow') }}</p>
        <h1>{{ t('header_title') }}</h1>
      </div>
      <div class="actions">
        <button
          v-if="props.showBack"
          type="button"
          class="btn btn--ghost btn--icon"
          :aria-label="t('button_back_home')"
          :title="t('button_back_home')"
          @click="emit('back')"
        >
          <i class="pi pi-arrow-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn--ghost" @click="clearRequests">{{ t('button_clear') }}</button>
        <button type="button" class="btn" @click="refreshRequests">{{ t('button_refresh') }}</button>
      </div>
    </header>

    <section class="toolbar">
      <input
        v-model="searchTerm"
        type="search"
        :placeholder="t('search_placeholder')"
        aria-label="Search"
      />
      <span class="counter">{{ filteredCount }} / {{ totalRequests }}</span>
    </section>

    <section v-if="error" class="error">{{ error }}</section>
    <section v-else-if="loading" class="loading">{{ t('loading_label') }}</section>
    <section v-else class="groups">
      <template v-for="group in groupedRequests" :key="group.projection">
        <div class="group-header">
          <div class="group-title">
            <h2>{{ group.projection }}</h2>
            <span class="group-count">{{ group.items.length }}</span>
            <button type="button" class="btn btn--ghost btn--tiny btn--icon" @click="toggleProjection(group.projection)">
              <i
                :class="['pi', isProjectionCollapsed(group.projection) ? 'pi-chevron-down' : 'pi-chevron-up']"
                aria-hidden="true"
              ></i>
            </button>
          </div>
          <button
            v-if="group.openApiUrl"
            type="button"
            class="btn btn--ghost btn--tiny"
            @click="openDocsByUrl(group.openApiUrl)"
          >
            {{ t('button_doc_openapi') }}
          </button>
        </div>
        <article v-for="req in group.items" v-show="!isProjectionCollapsed(group.projection)" :key="req.id" class="card">
          <div class="card-head">
            <div class="top-row">
              <div class="left">
                <span class="badge method">{{ req.method }}</span>
                <span class="code target" v-html="highlightCustomFields(req, req.target)"></span>
                <span v-if="req.hasCustomFields" class="badge custom">{{ t('badge_custom_fields') }}</span>
              </div>
              <button type="button" class="btn btn--ghost btn--tiny btn--icon" @click="toggleDetails(req.id)">
                <i :class="['pi', isExpanded(req.id) ? 'pi-chevron-up' : 'pi-chevron-down']" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div v-if="isExpanded(req.id)" class="details">
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
            <button type="button" class="btn btn--ghost btn--tiny" @click="copyText(req.url, 'url')">
              {{ t('button_copy_url') }}
            </button>
            <button type="button" class="btn btn--ghost btn--tiny" @click="copyText(req.curl, 'curl')">
              {{ t('button_copy_curl') }}
            </button>
          </div>
        </article>
      </template>

      <p v-if="!groupedRequests.length" class="empty">{{ formattedEmptyMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.sniffer * {
  box-sizing: border-box;
}

.sniffer {
  width: 100%;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #0f172a;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
  margin: 0;
  color: #94a3b8;
}
h1 {
  margin: 2px 0;
  font-size: 18px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar input {
  flex: 1;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  padding: 8px 12px;
  font-size: 12px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.08);
}
.counter {
  font-size: 12px;
  color: #64748b;
}
.groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 4px 2px;
}
.group-title {
  display: flex;
  gap: 6px;
  align-items: center;
}
.group-header h2 {
  font-size: 14px;
  margin: 0;
  color: #1e1b4b;
}
.group-count {
  background: rgba(79, 70, 229, 0.12);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  color: #4f46e5;
}
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
.loading,
.error,
.empty {
  font-size: 13px;
  color: #64748b;
  margin: 8px 0;
}
.error {
  color: #b91c1c;
}
</style>
