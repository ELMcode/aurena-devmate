import { type MessageKey } from './common';

export type ODataParams = {
    filter?: string;
    select?: string;
    orderby?: string;
    expand?: string;
    top?: string;
    skip?: string;
    raw: Record<string, string>;
};

export type UiRequest = {
    id: string;
    method: string;
    url: string;
    projection?: string;
    resource?: string;
    odata?: ODataParams;
    statusCode?: number;
    time: number;
    curl: string;
};

export type EnhancedRequest = UiRequest & {
    when: string;
    target: string;
    hasCustomFields: boolean;
    customFields: string[];
    highlightRegex?: RegExp | null;
    openApiUrl?: string | null;
};

export type ODataGroup = {
    projection: string;
    items: EnhancedRequest[];
    openApiUrl?: string | null;
};
