import { type FieldInfo, CONSTANTS } from '../../../types/inspector';

const { FIELD_ATTR } = CONSTANTS;

/**
 * Generates a unique ID for a field if it doesn't already have one.
 */
export function generateFieldId(): string {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : `fi-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Computes a unique CSS-like path for an element (limited to 6 levels).
 */
export function computeElementPath(node: Element): string {
    const parts: string[] = [];
    let current: Element | null = node;
    while (current && current.nodeType === 1 && parts.length < 6) {
        const index = Array.from(current.parentElement?.children ?? []).indexOf(current) + 1;
        const tag = current.tagName.toLowerCase();
        const cls = (current.getAttribute('class') || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join('.');
        parts.unshift(`${tag}${cls ? '.' + cls : ''}:nth-child(${index})`);
        current = current.parentElement;
    }
    return parts.join(' > ');
}

/**
 * Extracts a human-readable label for a given element using strictly local heuristics.
 */
export function extractLabel(el: HTMLElement): string | null {
    // 1. Native label association
    const labelList = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).labels;
    if (labelList && labelList.length) {
        const text = labelList[0]?.innerText?.trim();
        if (text) return text;
    }

    // 2. Explicit attributes
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;

    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.length < 50) return placeholder;

    const title = el.getAttribute('title');
    if (title && title.length < 50) return title;

    // 3. Specific parent label wrapper
    const parent = el.parentElement;
    if (parent) {
        const labelEl = parent.querySelector('label, .label, .label-container, .ifs-label');
        if (labelEl && labelEl.textContent) {
            const text = labelEl.textContent.trim();
            if (text && text.length < 60) return text;
        }
    }

    return null;
}

/**
 * Determines if an element is a valid field candidate.
 */
export function isFieldCandidate(el: Element): el is HTMLElement {
    const tag = el.tagName.toLowerCase();

    // Exclude large structural containers
    if (el.classList.contains('ifs-group') || el.classList.contains('ifs-list')) return false;

    // Direct inputs
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

    // Aurena field wrappers
    if (el.classList.contains('ifs-field') || el.classList.contains('field-container')) return true;

    // Metadata attributes
    if (el.hasAttribute('data-fieldname') || el.hasAttribute('data-binding')) return true;

    // Interactive links
    if (tag === 'a' && (el.classList.contains('ifs-link') || el.classList.contains('ifs-field'))) return true;

    // ARIA roles
    const role = el.getAttribute('role');
    const interactiveRoles = ['textbox', 'combobox', 'listbox', 'spinbutton', 'checkbox', 'switch'];
    if (role && interactiveRoles.includes(role)) return true;

    return el.hasAttribute('contenteditable');
}

/**
 * Finds the binding name (fieldname) for an element by climbing the tree.
 */
export function resolveBinding(el: HTMLElement): string | null {
    const container = el.closest<HTMLElement>('[data-fieldname]');
    return container?.dataset?.fieldname ?? null;
}

/**
 * Performs a deep walk of the DOM, including Shadow DOM penetration.
 */
export function walkAllNodes(root: Document | ShadowRoot): Element[] {
    const results: Element[] = [];
    const queue: (Document | ShadowRoot | Element)[] = [root];
    while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        const children = current instanceof Element || current instanceof DocumentFragment
            ? current.children
            : current.childNodes;

        Array.from(children).forEach((child) => {
            if (child.nodeType !== 1) return;
            const el = child as Element;
            results.push(el);
            if ((el as HTMLElement).shadowRoot) queue.push((el as HTMLElement).shadowRoot as ShadowRoot);
            queue.push(el);
        });
    }
    return results;
}
