import { browser } from 'wxt/browser';

export type EnvInstance = {
  id: string;
  name: string;
  url: string;
  color: string;
};

export type EnvSettings = EnvInstance[];

const STORAGE_KEY = 'devmate:env-settings';

const DEFAULT_SETTINGS: EnvSettings = [
  { id: 'prod', name: 'PROD', url: '', color: '#1d4ed8' },
  { id: 'uat', name: 'UAT', url: '', color: '#be185d' },
  { id: 'cfg', name: 'CFG', url: '', color: '#eab308' },
  { id: 'dev', name: 'DEV', url: '', color: '#7c3aed' },
];

export function getDefaultEnvSettings(): EnvSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

export async function loadEnvSettings(): Promise<EnvSettings> {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const settings = stored[STORAGE_KEY] as EnvSettings | undefined;
    if (!settings) return getDefaultEnvSettings();
    if (!Array.isArray(settings)) return getDefaultEnvSettings();
    return settings;
  } catch {
    return getDefaultEnvSettings();
  }
}

export async function saveEnvSettings(settings: EnvSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return value;
  }
}
