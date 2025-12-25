import { browser } from 'wxt/browser';
import { CONSTANTS, type FieldInfo, type InspectorMessage } from '../types/inspector';
import {
  generateFieldId,
  computeElementPath,
  extractLabel,
  isFieldCandidate,
  resolveBinding,
  walkAllNodes
} from './inspector/utils/dom';
import {
  resolveBasePath,
  loadPageMetadata,
  fetchDebugDetails,
  enrichFields
} from './inspector/utils/metadata';

const { FIELD_ATTR, HIGHLIGHT_CLASS, SELECTED_CLASS, STYLE_ID, OVERLAY_ID } = CONSTANTS;

let pickMode = false;
let lastPickedHover: string | null = null;
let previousCursor: string | null = null;
let selectedId: string | null = null;

/**
 * Injects necessary styles for field highlighting and pick mode.
 */
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [${FIELD_ATTR}] { position: relative; }
    [${FIELD_ATTR}].${HIGHLIGHT_CLASS} {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px !important;
      border-radius: 4px;
      background: rgba(245, 158, 11, 0.08) !important;
      transition: outline-color 0.15s ease, background-color 0.15s ease;
      z-index: 200000;
    }
    [${FIELD_ATTR}].${SELECTED_CLASS} {
      outline: 3px solid #f97316 !important;
      outline-offset: 2px !important;
      border-radius: 4px;
      background: rgba(249, 115, 22, 0.12) !important;
      z-index: 199999;
    }
    #${OVERLAY_ID} {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: transparent;
      cursor: crosshair;
      z-index: 2147483646;
      pointer-events: all;
    }
    .pulse { animation: pulse-highlight 1.2s ease-out; }
    @keyframes pulse-highlight {
      0% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.4); transform: scale(1.01); }
      50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.2); }
      100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); transform: scale(1); }
    }
  `;
  document.documentElement.appendChild(style);
}

/**
 * Scans the DOM and collects information about all field candidates.
 */
function collectFields(): FieldInfo[] {
  injectStyles();
  const candidates = walkAllNodes(document).filter(isFieldCandidate);

  // Deduplicate candidates to avoid picking nested elements when container is enough
  const filtered = candidates.filter(el => {
    let parent = el.parentElement;
    while (parent) {
      if (candidates.includes(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  });

  return filtered.map((el) => {
    let id = el.getAttribute(FIELD_ATTR);
    if (!id) {
      id = generateFieldId();
      (el as HTMLElement).setAttribute(FIELD_ATTR, id);
    }

    const label = extractLabel(el as HTMLElement);
    const binding = resolveBinding(el as HTMLElement);
    if (label) (el as HTMLElement).setAttribute('data-devmate-label', label);

    return {
      id,
      label,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      path: computeElementPath(el),
      binding,
      custom: binding ? /^cf_/i.test(binding) : undefined,
    };
  });
}

/**
 * Main orchestration for page scanning and metadata enrichment.
 */
async function scanAndEnrich(): Promise<FieldInfo[]> {
  const domFields = collectFields();
  const meta = await loadPageMetadata();
  const viewMap = meta?.projectionName
    ? await fetchDebugDetails(resolveBasePath(), meta.projectionName)
    : {};

  const enriched = enrichFields(domFields, meta, viewMap);

  // Cleanup artifacts for elements that didn't match metadata
  enriched.forEach((field) => {
    if (field.meta) return;
    const el = document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${field.id}"]`);
    if (el) {
      el.classList.remove(HIGHLIGHT_CLASS);
      el.removeAttribute(FIELD_ATTR);
      el.removeAttribute('data-devmate-label');
    }
  });

  return enriched.filter((f) => f.meta);
}

/**
 * Visual feedback management.
 */
function highlight(id: string): void {
  const target = document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${id}"]`);
  if (target) target.classList.add(HIGHLIGHT_CLASS);
}

function clearHighlight(id?: string): void {
  if (!id) {
    document.querySelectorAll<HTMLElement>(`[${FIELD_ATTR}]`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS));
  } else {
    document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${id}"]`)?.classList.remove(HIGHLIGHT_CLASS);
  }
}

function markFieldSelected(id: string | null): void {
  if (selectedId) {
    document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${selectedId}"]`)?.classList.remove(SELECTED_CLASS);
  }

  if (id === selectedId) {
    selectedId = null;
  } else {
    selectedId = id;
    if (id) {
      document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${id}"]`)?.classList.add(SELECTED_CLASS);
    }
  }
}

/**
 * Pick mode interaction handlers.
 */
function handlePickClick(event: MouseEvent): void {
  if (!pickMode) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  let pickedId: string | null = null;

  for (const el of elements) {
    if (el.id === OVERLAY_ID) continue;
    const fieldEl = (el as HTMLElement).closest?.(`[${FIELD_ATTR}]`) as HTMLElement | null;
    if (fieldEl) {
      pickedId = fieldEl.getAttribute(FIELD_ATTR);
      break;
    }
  }

  if (!pickedId) return;

  const target = document.querySelector<HTMLElement>(`[${FIELD_ATTR}="${pickedId}"]`);
  if (target) {
    target.classList.add('pulse');
    const originalBg = target.style.backgroundColor;
    target.style.backgroundColor = 'rgba(34, 197, 94, 0.4)';
    setTimeout(() => {
      if (target) {
        target.style.backgroundColor = originalBg;
        target.classList.remove('pulse');
      }
    }, 400);
  }

  markFieldSelected(pickedId);
  void browser.runtime.sendMessage({ type: 'devmate:fi-picked', id: pickedId });
  stopPick();
}

function startPick(): void {
  if (pickMode) return;
  pickMode = true;
  lastPickedHover = null;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  document.body.appendChild(overlay);

  overlay.addEventListener('mousemove', (e) => {
    if (!pickMode) return;
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let id: string | null = null;
    for (const el of elements) {
      if (el.id === OVERLAY_ID) continue;
      const fieldEl = (el as HTMLElement).closest?.(`[${FIELD_ATTR}]`) as HTMLElement | null;
      if (fieldEl) {
        id = fieldEl.getAttribute(FIELD_ATTR);
        break;
      }
    }

    if (id === lastPickedHover) return;
    if (lastPickedHover && lastPickedHover !== selectedId) clearHighlight(lastPickedHover);
    if (id) highlight(id);
    lastPickedHover = id;
  }, true);

  overlay.addEventListener('click', handlePickClick, true);
  previousCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'crosshair';
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pickMode) stopPick();
  }, { once: true, capture: true });
}

function stopPick(): void {
  if (!pickMode) return;
  pickMode = false;
  document.getElementById(OVERLAY_ID)?.remove();
  if (lastPickedHover && lastPickedHover !== selectedId) clearHighlight(lastPickedHover);
  lastPickedHover = null;
  if (previousCursor !== null) {
    document.documentElement.style.cursor = previousCursor;
    previousCursor = null;
  }
  void browser.runtime.sendMessage({ type: 'devmate:fi-pick-ended' });
}

/**
 * Content Script Initialization.
 */
export default defineContentScript({
  matches: ['*://*/ifsapplications/web/*', '*://*/*/ifsapplications/web/*'],
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener((msg: InspectorMessage, _sender, sendResponse) => {
      switch (msg.type) {
        case 'devmate:fi-scan':
          scanAndEnrich().then(fields => sendResponse({ fields }));
          return true;
        case 'devmate:fi-highlight':
          highlight(msg.id);
          sendResponse({ ok: true });
          break;
        case 'devmate:fi-select':
          markFieldSelected(msg.id);
          if (msg.id) {
            document.querySelector(`[${FIELD_ATTR}="${msg.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          sendResponse({ ok: true });
          break;
        case 'devmate:fi-clear':
          clearHighlight(msg.id);
          sendResponse({ ok: true });
          break;
        case 'devmate:fi-pick':
          msg.enabled ? startPick() : stopPick();
          sendResponse({ ok: true });
          break;
        case 'devmate:fi-pick-status':
          sendResponse({ active: pickMode });
          break;
      }
      return undefined;
    });
  },
});
