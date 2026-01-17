import { browser } from 'wxt/browser';

const STYLE_ID = 'devmate-blur-style';

let blurActive = false;

/**
 * Injects CSS to blur sensitive field values on the page.
 */
function injectBlurStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    /* ============================================
       DevMate Blur Mode
       ============================================ */

    :root {
      --devmate-blur-size: 4px;
    }

    /* === BLUR: IFS Aurena field wrappers and values === */

    /* Fields with data-fieldname/data-binding attribute (main IFS field identifiers) */
    :is([data-fieldname], [data-binding]) :is(
      input,
      textarea,
      select,
      .k-input-inner,
      .k-input-value-text,
      [role="textbox"],
      [role="combobox"],
      [role="listbox"],
      [role="spinbutton"]
    ),

    /* IFS field containers */
    :is(.ifs-field, .field-container) :is(
      input,
      textarea,
      select,
      .k-input-inner,
      .k-input-value-text
    ),

    /* Direct inputs (fallback) */
    input[type="text"],
    input[type="number"],
    input[type="email"],
    input[type="tel"],
    input[type="date"],
    input[type="datetime-local"],
    input:not([type]),
    textarea,
    select,

    /* Kendo UI inputs */
    .k-input-inner,
    .k-input-value-text,
    span.k-input,
    .k-textbox input,

    /* ARIA interactive roles (same as Field Inspector) */
    [role="textbox"],
    [role="combobox"] .k-input-value-text,
    [role="listbox"] .k-list-item-text,
    [role="spinbutton"] input,

    /* Read-only values in field containers (avoid blurring labels) */
    :is([data-fieldname], [data-binding]) [data-fnd="containerField"] :is(
      .ifs-field,
      .hyperlink-text,
      .value,
      .multi-line
    ),

    /* Container field multi-line values (e.g., address) */
    [data-fnd="containerField"] .multi-line,
    .ifs-field.address .multi-line,
    fnd-address .multi-line,

    /* Title record values */
    [data-fnd="title-record"],
    .title-record-part,

    /* Selector/list values (label stays readable) */
    fnd-record-selector .value,
    fnd-record-selector-item .value,
    .nav-main .value,
    [role="link"] .value,

    /* Data table row values (fnd-data-table) */
    fnd-row :is(fnd-cell[data-fieldname], fnd-cell[data-binding]) :is(
      .static-field-content,
      .static-field-content > div,
      a,
      .value,
      .multi-line
    ),

    /* Multi-line static values outside grids */
    fnd-static-field .multi-line,
    fnd-static-field .static-field-content.multi-line,
    fnd-static-field .static-field-content .multi-line,

    /* Grid/table cells that declare a field */
    .k-grid td[data-fieldname],
    .k-grid td[data-binding],
    [role="gridcell"][data-fieldname],
    [role="gridcell"][data-binding],

    /* IFS groups - blur values inside */
    .ifs-group :is(
      input,
      .k-input-inner,
      .k-input-value-text
    ) {
      filter: blur(var(--devmate-blur-size)) !important;
      -webkit-filter: blur(var(--devmate-blur-size)) !important;
    }

    /* === EXCLUSIONS: Keep these visible === */

    /* Buttons and actions */
    button, .k-button, [role="button"],
    input[type="button"], input[type="submit"], input[type="reset"],
    .k-button-text,

    /* Icons */
    .k-icon, .k-svg-icon, .pi, i[class*="icon"], span.k-icon,
    [class*="Icon"]:not(.k-input-inner),

    /* Checkboxes and radio */
    input[type="checkbox"], input[type="radio"],
    .k-checkbox, .k-radio,
    td:first-child, .k-grid td:first-child,

    /* Labels */
    label, .k-label, .k-form-label, .ifs-label, .label,

    /* Headers */
    th, .k-header, thead td, .k-grid-header,

    /* Navigation and menus */
    nav, .k-menu, .k-tabstrip, [role="tab"], [role="menu"],
    [role="menuitem"], [role="navigation"], .k-toolbar,

    /* State badges (keep visible) */
    .k-badge, [class*="badge"], [class*="state-indicator"] {
      filter: none !important;
      -webkit-filter: none !important;
    }
  `;
    document.documentElement.appendChild(style);
    blurActive = true;
}

/**
 * Removes the blur styles from the page.
 */
function removeBlurStyles(): void {
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
    }
    blurActive = false;
}

/**
 * Toggles blur state.
 */
function toggleBlur(enabled: boolean): void {
    if (enabled) {
        injectBlurStyles();
    } else {
        removeBlurStyles();
    }
}

type BlurMessage =
    | { type: 'devmate:blur-toggle'; enabled: boolean }
    | { type: 'devmate:blur-status' };

/**
 * Content Script Initialization.
 */
export default defineContentScript({
    matches: ['*://*/ifsapplications/*', '*://*/*/ifsapplications/*'],
    runAt: 'document_idle',
    main() {
        browser.runtime.onMessage.addListener((msg: BlurMessage, _sender, sendResponse) => {
            switch (msg.type) {
                case 'devmate:blur-toggle':
                    toggleBlur(msg.enabled);
                    sendResponse({ ok: true, active: blurActive });
                    break;
                case 'devmate:blur-status':
                    sendResponse({ active: blurActive });
                    break;
            }
            return undefined;
        });
    },
});
