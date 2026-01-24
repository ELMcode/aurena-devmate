import { parseProjectionRequest } from '@/utils/ifs-odata';
import { buildCurlCommand } from '@/utils/odata-helpers';
import type { ODataParams } from '@/utils/ifs-odata';
import type { Browser } from 'wxt/browser';

type SniffedRequest = {
  id: string;
  tabId: number;
  method: string;
  url: string;
  time: number;
  projection?: string;
  resource?: string;
  odata?: ODataParams;
  headers?: Array<{ name: string; value: string }>;
  statusCode?: number;
};

const PER_TAB_LIMIT = 50;
const requestStore = new Map<number, SniffedRequest[]>();
const pendingHeaders = new Map<string, Array<{ name: string; value: string }>>();
let allRequests: SniffedRequest[] = [];
const STORAGE_KEY = 'devmate:requests';

type StoredSnapshot = {
  perTab: Record<string, SniffedRequest[]>;
  all: SniffedRequest[];
};

async function hydrateFromStorage() {
  try {
    const stored = await browser.storage.session.get(STORAGE_KEY);
    const snapshot = stored[STORAGE_KEY] as StoredSnapshot | undefined;
    if (!snapshot) return;
    allRequests = snapshot.all ?? [];
    requestStore.clear();
    Object.entries(snapshot.perTab ?? {}).forEach(([tabId, list]) => {
      requestStore.set(Number(tabId), list);
    });
  } catch (err) {
    console.warn('[DevMate] hydrate error', err);
  }
}

async function persistToStorage() {
  try {
    const perTab: Record<string, SniffedRequest[]> = {};
    requestStore.forEach((value, key) => {
      perTab[String(key)] = value;
    });
    const snapshot: StoredSnapshot = { perTab, all: allRequests };
    await browser.storage.session.set({ [STORAGE_KEY]: snapshot });
  } catch (err) {
    console.warn('[DevMate] persist error', err);
  }
}

function addRequest(tabId: number, entry: SniffedRequest) {
  const current = requestStore.get(tabId) ?? [];
  current.unshift(entry);
  if (current.length > PER_TAB_LIMIT) current.pop();
  requestStore.set(tabId, current);

  allRequests.unshift(entry);
  if (allRequests.length > PER_TAB_LIMIT) allRequests.pop();

  void persistToStorage();
}

export default defineBackground(() => {
  const filters = {
    urls: [
      '*://*/ifsapplications/projection/v1/*', // root deployments
      '*://*/*/ifsapplications/projection/v1/*', // with context (main/int/uat/...)
    ],
  };

  void hydrateFromStorage();

  // Capture outgoing headers for cURL reconstruction.
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details): Browser.webRequest.BlockingResponse | undefined => {
      if (details.tabId === -1) return undefined;
      const headers =
        details.requestHeaders?.flatMap((h) => (h.value ? [{ name: h.name, value: h.value }] : [])) ?? [];
      pendingHeaders.set(details.requestId, headers);
      return undefined;
    },
    filters,
    ['requestHeaders', 'extraHeaders'],
  );

  // Store the request once it completes (ensures tabId is stable and we have status).
  browser.webRequest.onCompleted.addListener(
    (details) => {
      if (details.tabId === -1) return;
      const parsed = parseProjectionRequest(details.url);

      const entry: SniffedRequest = {
        id: details.requestId,
        tabId: details.tabId,
        method: details.method,
        url: details.url,
        time: Date.now(),
        projection: parsed ? parsed.projection : undefined,
        resource: parsed ? parsed.resource : undefined,
        odata: parsed ? parsed.odata : undefined,
        headers: pendingHeaders.get(details.requestId),
        statusCode: details.statusCode,
      };

      addRequest(details.tabId, entry);
      pendingHeaders.delete(details.requestId);
    },
    filters,
  );

  // Clean up pending header entries if a request errors out.
  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      pendingHeaders.delete(details.requestId);
    },
    filters,
  );

  // Store for picked field ID (to pass between popup close and reopen)
  let pendingPickedField: { tabId: number; fieldId: string } | null = null;

  // Message API for the popup and content scripts.
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'getRequests') {
      const tabId = message.tabId ?? sender.tab?.id;
      const list = typeof tabId === 'number' ? requestStore.get(tabId) ?? [] : allRequests;
      sendResponse(
        list.map((req) => ({
          ...req,
          curl: buildCurlCommand(req.method, req.url, req.headers),
        })),
      );
      return true;
    }

    if (message?.type === 'clearRequests') {
      const tabId = message.tabId ?? sender.tab?.id;
      if (typeof tabId === 'number') {
        requestStore.set(tabId, []);
        void persistToStorage();
        sendResponse([]);
        return true;
      }
      allRequests = [];
      requestStore.clear();
      void persistToStorage();
      sendResponse([]);
      return true;
    }

    // Handle field picked from content script - store the ID and reopen popup
    if (message?.type === 'devmate:fi-picked') {
      const tabId = sender.tab?.id;
      if (typeof tabId === 'number' && typeof message.id === 'string') {
        pendingPickedField = { tabId, fieldId: message.id };
        // Try to reopen the popup (Chrome MV3 API)
        void (async () => {
          try {
            await browser.action.openPopup();
          } catch (err) {
            // openPopup may fail in some contexts (e.g., Firefox or user gesture required)
            console.warn('[DevMate] Could not reopen popup:', err);
          }
        })();
      }
      sendResponse({ ok: true });
      return true;
    }

    // Popup requests any pending picked field
    if (message?.type === 'devmate:fi-get-picked') {
      const result = pendingPickedField;
      pendingPickedField = null; // Clear after retrieval
      sendResponse(result);
      return true;
    }

    return false;
  });
});
