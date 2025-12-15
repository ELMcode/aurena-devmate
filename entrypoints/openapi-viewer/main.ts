import SwaggerUI from 'swagger-ui-dist/swagger-ui-es-bundle';
import 'swagger-ui-dist/swagger-ui.css';

const statusEl = document.getElementById('status');
const projectionTitle = document.getElementById('projection-name');
const backButton = document.getElementById('back-button');
const uiContainer = document.getElementById('swagger-ui');

const specParam = new URLSearchParams(window.location.search).get('spec');
const decodedSpecUrl = specParam ? decodeURIComponent(specParam) : null;

if (backButton) {
  backButton.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  });
}

async function loadSpec() {
  if (!decodedSpecUrl || !statusEl || !uiContainer) {
    if (statusEl) statusEl.textContent = 'spec parameter is missing.';
    return;
  }

  try {
    const url = new URL(decodedSpecUrl);
    projectionTitle!.textContent = url.pathname.split('/').pop()?.replace('.svc', '') ?? '';
  } catch {
    projectionTitle!.textContent = decodedSpecUrl;
  }

  try {
    const response = await fetch(decodedSpecUrl, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const spec = await response.json();
    statusEl.textContent = '';
    SwaggerUI({
      domNode: uiContainer,
      spec,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Unable to load the documentation.';
  }
}

loadSpec();
