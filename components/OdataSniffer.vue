<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, onMounted, ref } from 'vue';
import { type UiRequest, type EnhancedRequest, type ODataGroup } from '@/types/odata';
import { type TranslateFn } from '@/types/common';
import { escapeRegex, buildOpenApiUrl } from '@/utils/odata-helpers';
import OdataRequestCard from './OdataRequestCard.vue';

const props = defineProps<{ showBack?: boolean }>();
const emit = defineEmits<{ (e: 'back'): void }>();

const tabId = ref<number | null>(null);
const requests = ref<UiRequest[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchTerm = ref('');
const filterCustomOnly = ref(false);
const filterMethod = ref<'all' | 'GET' | 'POST' | 'PATCH'>('all');
const filterStatus = ref<'all' | '2xx' | '3xx' | '4xx' | '5xx'>('all');
const expanded = ref(new Set<string>());
const collapsedProjections = ref(new Set<string>());

/**
 * Standardized translation helper.
 */
const t: TranslateFn = (key, substitutions = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

const totalRequests = computed(() => requests.value.length);

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

function toggleProjection(name: string) {
  const next = new Set(collapsedProjections.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  collapsedProjections.value = next;
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
        openApiUrl: buildOpenApiUrl(req.url, req.projection),
      };
    })
    .filter((req) => {
      // 1. Text Search
      if (q) {
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
        if (!haystack.includes(q)) return false;
      }

      // 2. Custom Fields Filter
      if (filterCustomOnly.value && !req.hasCustomFields) return false;

      // 3. Method Filter
      if (filterMethod.value !== 'all' && req.method !== filterMethod.value) return false;

      // 4. Status Filter
      if (filterStatus.value !== 'all') {
        const code = req.statusCode ?? 0;
        if (filterStatus.value === '2xx' && (code < 200 || code >= 300)) return false;
        if (filterStatus.value === '3xx' && (code < 300 || code >= 400)) return false;
        if (filterStatus.value === '4xx' && (code < 400 || code >= 500)) return false;
        if (filterStatus.value === '5xx' && code < 500) return false;
      }

      return true;
    });
});

const groupedRequests = computed<ODataGroup[]>(() => {
  const groups = new Map<string, { items: EnhancedRequest[]; openApiUrl?: string | null }>();
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
      <div class="search-box">
        <input
          v-model="searchTerm"
          type="search"
          :placeholder="t('search_placeholder')"
          aria-label="Search"
        />
        <span class="counter">{{ filteredCount }} / {{ totalRequests }}</span>
      </div>
      
      <div class="filters">
        <button 
          type="button" 
          class="btn btn--tiny" 
          :class="filterCustomOnly ? '' : 'btn--ghost'"
          @click="filterCustomOnly = !filterCustomOnly"
        >
          <i class="pi pi-filter" aria-hidden="true"></i>
          {{ t('sniffer_filter_custom') }}
        </button>

        <div class="method-selector">
          <label class="sr-only">{{ t('sniffer_filter_method') }}</label>
          <select v-model="filterMethod" class="select--tiny">
            <option value="all">{{ t('sniffer_method_all') }}</option>
            <option value="GET">{{ t('sniffer_method_get') }}</option>
            <option value="POST">{{ t('sniffer_method_post') }}</option>
            <option value="PATCH">{{ t('sniffer_method_patch') }}</option>
          </select>
        </div>

        <div class="method-selector">
          <label class="sr-only">{{ t('sniffer_filter_status') }}</label>
          <select v-model="filterStatus" class="select--tiny">
            <option value="all">{{ t('sniffer_status_all') }}</option>
            <option value="2xx">{{ t('sniffer_status_2xx') }}</option>
            <option value="3xx">{{ t('sniffer_status_3xx') }}</option>
            <option value="4xx">{{ t('sniffer_status_4xx') }}</option>
            <option value="5xx">{{ t('sniffer_status_5xx') }}</option>
          </select>
        </div>
      </div>
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
                :class="['pi', collapsedProjections.has(group.projection) ? 'pi-chevron-down' : 'pi-chevron-up']"
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
        
        <div v-show="!collapsedProjections.has(group.projection)" class="cards">
            <OdataRequestCard 
                v-for="req in group.items" 
                :key="req.id" 
                :req="req"
                :isExpanded="expanded.has(req.id)"
                :t="t"
                @toggle="toggleDetails(req.id)"
                @copy="copyText"
            />
        </div>
      </template>

      <p v-if="!groupedRequests.length" class="empty">{{ formattedEmptyMessage }}</p>
    </section>
  </div>
</template>

<style scoped>
.sniffer {
  width: 100%;
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
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-box input {
  flex: 1;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  padding: 8px 12px;
  font-size: 12px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.08);
}
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.method-selector {
  display: flex;
  align-items: center;
}
.select--tiny {
    padding: 2px 4px;
    font-size: 11px;
    border-radius: 6px;
    border: 1px solid #c7d2fe;
    background: #fff;
    color: #4338ca;
    cursor: pointer;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
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
.cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.loading, .error, .empty {
  font-size: 13px;
  color: #64748b;
  margin: 8px 0;
}
.error { color: #b91c1c; }
</style>
