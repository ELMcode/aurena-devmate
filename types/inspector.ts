import { browser } from 'wxt/browser';
import { type PageFieldMeta } from '@/utils/page-metadata';

export type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

export interface FieldMetadata extends PageFieldMeta {
    entitySet?: string;
    view?: string;
    projection?: string;
    component?: string;
    isStructure?: boolean;
    isLov?: boolean;
    parentEntity?: string;
    parentEntitySet?: string;
    parentView?: string;
}

export interface FieldInfo {
    id: string;
    label: string | null;
    tag: string;
    type: string | null;
    name: string | null;
    placeholder: string | null;
    ariaLabel: string | null;
    path: string;
    binding?: string | null;
    meta?: FieldMetadata;
    custom?: boolean;
}

export const CONSTANTS = {
    FIELD_ATTR: 'data-devmate-fi',
    HIGHLIGHT_CLASS: 'devmate-fi-highlight',
    SELECTED_CLASS: 'devmate-fi-selected',
    STYLE_ID: 'devmate-fi-style',
    OVERLAY_ID: 'devmate-fi-overlay',
} as const;

export type InspectorMessage =
    | { type: 'devmate:fi-scan' }
    | { type: 'devmate:fi-highlight'; id: string }
    | { type: 'devmate:fi-select'; id: string | null }
    | { type: 'devmate:fi-clear'; id?: string }
    | { type: 'devmate:fi-pick'; enabled: boolean }
    | { type: 'devmate:fi-pick-status' };
