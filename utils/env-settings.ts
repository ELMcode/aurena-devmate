import { browser } from 'wxt/browser';

export type Environment = 'PROD' | 'UAT' | 'CFG' | 'DEV';

export type EnvSettings = Record<Environment, { url: string; color: string }>;

const STORAGE_KEY = 'devmate:env-settings';

const DEFAULT_SETTINGS: EnvSettings = {
  PROD: { url: '', color: '#1d4ed8' },
  UAT: { url: '', color: '#be185d' },
  CFG: { url: '', color: '#eab308' },
  DEV: { url: '', color: '#7c3aed' },
};

export function getDefaultEnvSettings(): EnvSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

export async function loadEnvSettings(): Promise<EnvSettings> {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const settings = stored[STORAGE_KEY] as EnvSettings | undefined;
    if (!settings) return getDefaultEnvSettings();
    return { ...getDefaultEnvSettings(), ...settings };
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
