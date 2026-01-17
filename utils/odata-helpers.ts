/**
 * Escapes HTML special characters in a string.
 */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Escapes special characters for use in a regular expression.
 */
export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a valid cURL command from a request method, URL, and optional headers.
 */
export function buildCurlCommand(method: string, url: string, headers?: Array<{ name: string; value: string }>): string {
    const parts = [`curl -X ${method.toUpperCase()}`, `'${url}'`];
    if (headers) {
        headers
            .filter((h) => !!h.value)
            .forEach((h) => {
                parts.push(`-H '${h.name}: ${h.value}'`);
            });
    }
    return parts.join(' ');
}

/**
 * Builds an OpenAPI spec URL for a given IFS projection request.
 */
export function buildOpenApiUrl(url: string, projection?: string): string | null {
    const PROJECTION_MARKER = '/ifsapplications/projection/v1/';
    if (!projection) return null;
    const markerIndex = url.indexOf(PROJECTION_MARKER);
    if (markerIndex === -1) return null;
    const base = url.slice(0, markerIndex + PROJECTION_MARKER.length);
    return `${base}${projection}.svc/$openapi`;
}

/**
 * Highlights OData query parameters with HTML spans.
 */
export function highlightOData(query: string): string {
    if (!query) return '';

    // 1. Escape HTML
    let html = escapeHtml(query);

    // 2. Map of replacements to avoid double-processing
    const replacements: Map<string, string> = new Map();
    let counter = 0;

    const addPlaceholder = (val: string, cssClass: string) => {
        const placeholder = `__ODATA_HL_${counter++}__`;
        replacements.set(placeholder, `<span class="${cssClass}">${val}</span>`);
        return placeholder;
    };

    // Protect strings (single quotes were escaped to &#39;)
    html = html.replace(/(&#39;.*?&#39;)/g, (match) => addPlaceholder(match, 'odata-value odata-value--string'));

    // Highlight System Options ($filter, etc.)
    html = html.replace(/(\$(?:filter|select|expand|top|skip|orderby|count|apply|compute|search|it|root|id))\b/gi, (match) =>
        addPlaceholder(match, 'odata-key')
    );

    // Highlight Functions (followed by parenthesis)
    html = html.replace(/\b(contains|endswith|startswith|length|indexof|substring|tolower|toupper|trim|concat|year|month|day|hour|minute|second|fractionalseconds|date|time|totaloffsetminutes|now|mindatetime|maxdatetime|round|floor|ceiling|isof|cast|geo\.distance|geo\.intersects|geo\.length)\b(?=\s*\(|%28|&040;)/gi, (match) =>
        addPlaceholder(match, 'odata-func')
    );

    // Highlight Logical/Arithmetic Operators
    html = html.replace(/\b(eq|ne|gt|ge|lt|le|and|or|not|has|in|add|sub|mul|div|mod)\b/gi, (match) =>
        addPlaceholder(match, 'odata-operator')
    );

    // Highlight Literals (Numbers, Booleans, null)
    html = html.replace(/\b(true|false|null)\b/gi, (match) => addPlaceholder(match, 'odata-value odata-value--boolean'));
    html = html.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, (match) => addPlaceholder(match, 'odata-value odata-value--number'));

    // Restore placeholders
    replacements.forEach((val, key) => {
        html = html.replace(key, val);
    });

    return html;
}
