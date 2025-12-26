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
