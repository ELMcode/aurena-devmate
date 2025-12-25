import { indexPageModel, type PageMetadataIndex, type PageFieldMeta } from '@/utils/page-metadata';
import { type FieldInfo, type FieldMetadata } from '../../../types/inspector';

/**
 * Resolves the IFS Applications base path from the current URL.
 */
export function resolveBasePath(): string {
    const { origin, pathname } = window.location;
    const match = pathname.match(/^(.*?\/ifsapplications)/);
    if (match) return `${origin}${match[1]}`;
    return `${origin}/ifsapplications`;
}

/**
 * Finds the metadata URL by inspecting performance resource timings.
 */
function findMetadataUrl(): string | null {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
        const name = entries[i].name;
        if (name.includes('/ifsapplications/web/server/metadata/cpi/')) return name;
    }
    return null;
}

/**
 * Infers the IFS page name from the URL.
 */
function inferPageName(): string | null {
    const match = window.location.pathname.match(/\/ifsapplications\/web\/page\/([^/;]+)/i);
    return match?.[1] ?? null;
}

/**
 * Fetches and indexes the IFS page model metadata.
 */
export async function loadPageMetadata(): Promise<PageMetadataIndex | null> {
    const existing = findMetadataUrl();
    const pageName = inferPageName();
    const base = resolveBasePath();
    const url = existing ?? (pageName ? `${base}/web/server/metadata/cpi/${pageName}` : null);

    if (!url) return null;

    try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;
        const json = await response.json();
        return indexPageModel(json);
    } catch (err) {
        console.warn('[DevMate] metadata fetch failed', err);
        return null;
    }
}

/**
 * Fetches technical debug details (View Mapping) for a projection.
 */
export async function fetchDebugDetails(basePath: string, projectionName: string): Promise<Record<string, string>> {
    const url = `${basePath}/projection/v1/FrameworkServices.svc/GetDebugDetails(ProjectionName='${encodeURIComponent(projectionName)}')`;
    try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return {};
        const json = await response.json();
        const map: Record<string, string> = {};
        (json.value as Array<{ EntityName?: string; FromView?: string }> | undefined)?.forEach((item) => {
            if (item?.EntityName && item?.FromView) {
                map[item.EntityName] = item.FromView;
            }
        });
        return map;
    } catch (err) {
        console.warn('[DevMate] debug details fetch failed', err);
        return {};
    }
}

/**
 * Enriches field information with metadata matches.
 */
export function enrichFields(
    fields: FieldInfo[],
    meta?: PageMetadataIndex | null,
    viewMap?: Record<string, string> | null,
): FieldInfo[] {
    if (!meta) return fields;

    return fields.map((field) => {
        const candidateKeys = [
            field.binding?.toLowerCase(),
            field.name?.toLowerCase(),
        ].filter(Boolean) as string[];

        const normalizeLabel = (label: string) =>
            label.toLowerCase().replace(/[.…]/g, '').replace(/\s+/g, ' ').trim();

        let metaEntry: PageFieldMeta | undefined;
        for (const key of candidateKeys) {
            const nameMatches = meta.byName[key] ?? [];
            const attrMatches = meta.byAttribute[key] ?? [];
            const candidates = nameMatches.length ? nameMatches : attrMatches;

            if (!candidates.length) continue;

            if (candidates.length === 1) {
                metaEntry = candidates[0];
                break;
            }

            // If multiple candidates, try to match by label
            if (field.label) {
                const target = normalizeLabel(field.label);
                const labelMatch = candidates.find((c) => c.label && normalizeLabel(c.label) === target);
                if (labelMatch) {
                    metaEntry = labelMatch;
                    break;
                }
            }

            metaEntry = candidates[0];
            break;
        }

        if (metaEntry) {
            const entityName = metaEntry.entity ?? '';
            const isStructure = /Structure$/i.test(entityName);
            const isLov = !isStructure && /Lov$/i.test(entityName);
            const candidateParent = isStructure
                ? entityName.replace(/Structure$/i, '')
                : isLov
                    ? entityName.replace(/Lov$/i, '')
                    : undefined;

            const parentEntity = candidateParent
                ? isLov
                    ? candidateParent
                    : (meta.entitySets[candidateParent] || viewMap?.[candidateParent] ? candidateParent : undefined)
                : undefined;

            field.meta = {
                ...metaEntry,
                projection: meta.projectionName,
                component: meta.component,
                view: metaEntry.entity ? viewMap?.[metaEntry.entity] : undefined,
                entitySet: metaEntry.entity ? meta.entitySets[metaEntry.entity] : undefined,
                isStructure,
                isLov,
                parentEntity,
                parentEntitySet: parentEntity ? meta.entitySets[parentEntity] : undefined,
                parentView: parentEntity ? viewMap?.[parentEntity] : undefined,
            };
            field.custom = field.custom || metaEntry.custom;
        }
        return field;
    });
}
