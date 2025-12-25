<script lang="ts" setup>
import { browser } from 'wxt/browser';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import type { FieldInfo, MessageKey } from '@/types/inspector';
import FieldCard from './FieldCard.vue';

type SenderLike = { tab?: { id?: number } };

/**
 * Standardized translation helper.
 */
const t = (key: MessageKey, substitutions: Array<string | number> = []) => {
  const message = browser.i18n.getMessage(
    key,
    substitutions.map((item) => String(item)),
  );
  return message || key;
};

const props = defineProps<{ showBack?: boolean; pendingFieldId?: string | null }>();
const emit = defineEmits<{ (e: 'back'): void }>();

// --- State ---
const tabId = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const fields = ref<FieldInfo[]>([]);
const searchTerm = ref('');
const baseUrl = ref<string | null>(null);
const pickActive = ref(false);
const selectedId = ref<string | null>(null);
const lastSelectedId = ref<string | null>(null);

// --- Computed ---
const filteredFields = computed(() => {
  const q = normalizeSearch(searchTerm.value);
  if (!q) return fields.value;

  return fields.value.filter((f) => {
    const haystack = [
      f.label,
      f.meta?.label,
      f.tag,
      f.type,
      f.name,
      f.placeholder,
      f.ariaLabel,
      f.path,
      f.binding,
      f.meta?.attribute,
      f.meta?.entity,
      f.meta?.translationKey,
      f.meta?.lov,
      f.meta?.datasource,
      f.meta?.datasourceFunction,
      f.meta?.section,
      f.meta?.view,
      f.meta?.projection,
      f.meta?.name,
      f.meta?.entitySet,
      f.meta?.component,
    ]
      .filter(Boolean)
      .join(' ');
    return normalizeSearch(haystack).includes(q);
  });
});

const totalCount = computed(() => fields.value.length);
const filteredCount = computed(() => filteredFields.value.length);

// --- Context & Tab Management ---

/**
 * Resolves the active tab and its base URL.
 */
async function resolveActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId.value = tab?.id ?? null;
  if (tab?.url) {
    try {
      const url = new URL(tab.url);
      const match = url.pathname.match(/^(.*?\/ifsapplications)/);
      baseUrl.value = `${url.origin}${match ? match[1] : '/ifsapplications'}`;
    } catch {
      baseUrl.value = null;
    }
  }
}

// --- Content Script Orchestration ---

/**
 * Requests a DOM scan and metadata enrichment from the content script.
 */
async function scanFields() {
  if (tabId.value === null) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-scan' });
    if (response && Array.isArray(response.fields)) {
      fields.value = response.fields;
    } else {
      fields.value = [];
    }
  } catch (err) {
    console.error('Scan error', err);
    error.value = t('fi_error_scan');
    fields.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Toggles a visual highlight in the browser tab.
 */
async function highlight(id: string) {
  if (tabId.value === null) return;
  try {
    await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-highlight', id });
  } catch (err) {
    console.error('Highlight error', err);
  }
}

/**
 * Synchronizes the selection state on the web page.
 */
async function selectOnPage(id: string | null) {
  if (tabId.value === null) return;
  try {
    await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-select', id });
  } catch (err) {
    console.error('Select on page error', err);
  }
}

/**
 * Clears highlights in the browser tab.
 */
async function clearHighlight(id?: string) {
  if (tabId.value === null) return;
  try {
    await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-clear', id });
  } catch (err) {
    console.error('Clear highlight error', err);
  }
}

// --- Interaction Helpers ---

/**
 * Handles field selection, including toggling and synchronization.
 */
function selectField(id: string, animate = false) {
  if (selectedId.value === id) {
    void clearHighlight(id);
    void selectOnPage(null);
    selectedId.value = null;
    lastSelectedId.value = null;
    return;
  }

  if (lastSelectedId.value && lastSelectedId.value !== id) {
    void clearHighlight(lastSelectedId.value);
  }
  
  selectedId.value = id;
  lastSelectedId.value = id;
  void highlight(id);
  void selectOnPage(id);
  
  // Scroll the list to the selected card
  nextTick(() => {
    const target = document.querySelector<HTMLElement>(`[data-fi-id="${id}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (animate) {
        target.classList.add('pulse');
        setTimeout(() => target.classList.remove('pulse'), 1200);
      }
    }
  });
}

function handleLeave(id: string) {
  if (selectedId.value === id) return;
  void clearHighlight(id);
}

/**
 * Activates or deactivates the "Pick" mode overlay on the page.
 */
async function setPickMode(enabled: boolean) {
  if (tabId.value === null) return;
  if (enabled && !fields.value.length) {
    await scanFields();
  }
  try {
    await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-pick', enabled });
    pickActive.value = enabled;
    if (enabled) window.close(); // Close popup when pick mode starts
  } catch (err) {
    console.error('Pick mode error', err);
  }
}

async function syncPickStatus() {
  if (tabId.value === null) return;
  try {
    const response = await browser.tabs.sendMessage(tabId.value, { type: 'devmate:fi-pick-status' });
    if (response && typeof response.active === 'boolean') {
      pickActive.value = response.active;
    }
  } catch {
    pickActive.value = false;
  }
}

/**
 * Opens a URL in a new tab using the safest available method.
 */
async function openExternal(url: string) {
  try {
    await browser.tabs.create({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// --- Internal Utilities ---

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Message orchestration from the content script.
 */
const onMessage = (msg: unknown, sender: SenderLike) => {
  if (!msg || typeof msg !== 'object') return;
  if (tabId.value !== null && sender?.tab?.id && sender.tab.id !== tabId.value) return;
  const payload = msg as { type?: string; id?: string };
  if (payload.type === 'devmate:fi-picked' && typeof payload.id === 'string') {
    pickActive.value = false;
    selectField(payload.id, true);
    return;
  }
  if (payload.type === 'devmate:fi-pick-ended') {
    pickActive.value = false;
  }
};

// --- Lifecycle ---
onMounted(async () => {
  await resolveActiveTab();
  browser.runtime.onMessage.addListener(onMessage);
  await syncPickStatus();
  await scanFields();
  if (props.pendingFieldId) {
    await nextTick();
    await nextTick();
    selectField(props.pendingFieldId, true);
  }
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(onMessage);
});
</script>

<template>
  <div class="inspector">
    <header class="header">
      <div>
        <p class="eyebrow">{{ t('fi_eyebrow') }}</p>
        <h1>{{ t('fi_title') }}</h1>
        <p class="desc">{{ t('fi_desc') }}</p>
      </div>
      <div class="actions">
        <button
          v-if="props.showBack"
          type="button"
          class="btn btn--ghost btn--icon"
          @click="emit('back')"
        >
          <i class="pi pi-arrow-left"></i>
        </button>
        <button type="button" class="btn" @click="scanFields">{{ t('fi_button_scan') }}</button>
        <button
          type="button"
          class="btn btn--ghost pick-btn"
          :class="{ 'is-active': pickActive }"
          @click="setPickMode(!pickActive)"
        >
          <i class="pi pi-crosshairs"></i>
          <span>{{ pickActive ? t('fi_button_pick_stop') : t('fi_button_pick') }}</span>
        </button>
      </div>
    </header>

    <section class="toolbar">
      <input
        v-model="searchTerm"
        type="search"
        :placeholder="t('fi_search_placeholder')"
        aria-label="Search"
      />
      <span class="counter">{{ filteredCount }} / {{ totalCount }}</span>
    </section>

    <p v-if="pickActive" class="status hint">{{ t('fi_pick_hint') }}</p>
    <p v-if="loading" class="status">{{ t('loading_label') }}</p>
    <p v-else-if="error" class="status error">{{ error }}</p>
    <p v-else-if="!fields.length" class="status">{{ t('fi_empty') }}</p>

    <div v-else class="grid">
      <FieldCard 
        v-for="field in filteredFields" 
        :key="field.id" 
        :field="field"
        :isSelected="selectedId === field.id"
        :t="t"
        :baseUrl="baseUrl"
        @select="selectField"
        @highlight="highlight"
        @leave="handleLeave"
        @open-external="openExternal"
      />
    </div>
  </div>
</template>

<style scoped>
.inspector { display: flex; flex-direction: column; gap: 12px; }
.header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.desc { margin: 4px 0 0; color: #475569; font-size: 13px; }
.actions { display: flex; gap: 8px; }
.toolbar { display: flex; align-items: center; gap: 8px; }
.toolbar input[type='search'] {
  flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; font-size: 13px;
}
.counter { font-size: 12px; color: #94a3b8; }
.status { margin: 8px 0; color: #64748b; font-size: 13px; }
.status.hint { color: #b45309; }
.status.error { color: #b91c1c; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }

.pick-btn { display: inline-flex; align-items: center; gap: 6px; }
.pick-btn i { font-size: 12px; }
.pick-btn.is-active { background: rgba(245, 158, 11, 0.15); color: #b45309; }
</style>
