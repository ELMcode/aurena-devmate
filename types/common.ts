import { browser } from 'wxt/browser';

/**
 * Standard type for browser.i18n.getMessage keys.
 */
export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export type FeatureId = 'odata' | 'inspector' | 'blur' | 'feature3' | 'settings';

export type Feature = {
    id: FeatureId;
    titleKey: MessageKey;
    descKey: MessageKey;
    ready: boolean;
    /** If true, this feature shows a toggle switch instead of an "Open" button. */
    toggleMode?: boolean;
};

/**
 * Standard interface for the translation helper function.
 */
export type TranslateFn = (key: MessageKey, substitutions?: Array<string | number>) => string;
