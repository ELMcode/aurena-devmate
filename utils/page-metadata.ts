export type PageFieldMeta = {
  attribute: string;
  name: string;
  label?: string;
  entity?: string;
  translationKey?: string;
  control?: string;
  lov?: string;
  datasource?: string;
  datasourceFunction?: string;
  required?: boolean;
  section?: string;
  sectionType?: string;
  custom?: boolean;
};

export type PageMetadataIndex = {
  pageName: string;
  projectionName?: string;
  component?: string;
  entitySets: Record<string, string>;
  fields: PageFieldMeta[];
  byAttribute: Record<string, PageFieldMeta[]>;
  byName: Record<string, PageFieldMeta[]>;
};

type LayoutSection = Record<string, { content?: unknown;[key: string]: unknown }>;

type ParsedSection = {
  sectionName?: string;
  sectionType?: string;
};

function pushToIndex(map: Record<string, PageFieldMeta[]>, key: string | undefined, value: PageFieldMeta) {
  if (!key) return;
  const k = key.toLowerCase();
  if (!map[k]) map[k] = [];
  map[k].push(value);
}

function normalizeContent(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
    // Some payloads store content as an object with numeric keys.
    return Object.values(obj) as Array<Record<string, unknown>>;
  }
  return [];
}

function collectFieldsFromContent(
  items: Array<Record<string, unknown>>,
  acc: PageFieldMeta[],
  section: ParsedSection,
) {
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.elementType === 'field' && item.field && typeof item.field === 'object') {
      const field = item.field as Record<string, unknown>;
      const attribute = (field.attribute as string) || (field.name as string);
      const name = (field.name as string) || attribute || '';
      if (!attribute && !name) return;
      const entry: PageFieldMeta = {
        attribute: attribute || name,
        name,
        label: field.label as string | undefined,
        entity: field.entity as string | undefined,
        translationKey: field.translationKey as string | undefined,
        control: field.control as string | undefined,
        lov: (field.lov as Record<string, unknown> | undefined)?.selector as string | undefined,
        datasource:
          (field.update as Record<string, unknown> | undefined)?.datasourceEntitySet as string | undefined,
        datasourceFunction:
          (field.update as Record<string, unknown> | undefined)?.datasourceFunction as string | undefined,
        required: Boolean(field.required),
        section: section.sectionName,
        sectionType: section.sectionType,
        custom: /^cf_/i.test(attribute || name),
      };
      const lov = field.lov as Record<string, unknown> | undefined;
      if (lov?.datasourceEntitySet) entry.datasource = lov.datasourceEntitySet as string;
      if (lov?.datasourceFunction) entry.datasourceFunction = lov.datasourceFunction as string;
      acc.push(entry);
    }

    // Recurse into nested content, if any.
    if (item.content) {
      collectFieldsFromContent(normalizeContent(item.content), acc, section);
    }
  });
}

function parseSection(section: LayoutSection | undefined, sectionType: string, acc: PageFieldMeta[]) {
  if (!section) return;
  Object.entries(section).forEach(([sectionName, definition]) => {
    if (!definition || typeof definition !== 'object') return;
    const contentItems: Array<Record<string, unknown>> = [
      ...normalizeContent((definition as any).content),
      ...normalizeContent((definition as any)['@[DIFF]PACKED']?.content),
    ];
    collectFieldsFromContent(contentItems, acc, { sectionName, sectionType });
  });
}

export function indexPageModel(model: Record<string, unknown>): PageMetadataIndex {
  const fields: PageFieldMeta[] = [];
  const layout = (model.layout as Record<string, unknown>) || {};
  const entitySets: Record<string, string> = {};

  const projection = model.projection as Record<string, unknown> | undefined;
  const contains = projection?.contains as Record<string, { entity?: string }> | undefined;
  if (contains) {
    Object.entries(contains).forEach(([name, entry]) => {
      const entity = entry?.entity;
      if (!entity) return;
      const existing = entitySets[entity];
      if (!existing || name.toLowerCase().endsWith('set')) {
        entitySets[entity] = name;
      }
    });
  }

  parseSection(layout.groups as LayoutSection, 'group', fields);
  parseSection(layout.lists as LayoutSection, 'list', fields);
  parseSection(layout.fieldsets as LayoutSection, 'fieldset', fields);
  parseSection(layout.singletons as LayoutSection, 'singleton', fields);
  parseSection(layout.cards as LayoutSection, 'card', fields);
  parseSection(layout.dialogs as LayoutSection, 'dialog', fields);
  parseSection(layout.selectors as LayoutSection, 'selector', fields);
  parseSection(layout.assistants as LayoutSection, 'assistant', fields);
  parseSection(layout.stateindicators as LayoutSection, 'stateindicator', fields);
  parseSection(layout.warnings as LayoutSection, 'warning', fields);

  const byAttribute: Record<string, PageFieldMeta[]> = {};
  const byName: Record<string, PageFieldMeta[]> = {};
  fields.forEach((f) => {
    pushToIndex(byAttribute, f.attribute, f);
    pushToIndex(byName, f.name, f);
  });

  return {
    pageName: (model.name as string) || '',
    projectionName: projection?.name as string | undefined,
    component: model.component as string | undefined,
    entitySets,
    fields,
    byAttribute,
    byName,
  };
}
