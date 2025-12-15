import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
const chromiumProfile = process.env.CHROMIUM_PROFILE_PATH;
if (!chromiumProfile) {
  throw new Error(
    'CHROMIUM_PROFILE_PATH is required. Set it in your .env.development.chrome (e.g. /Users/name/Library/Application Support/Google/Chrome/Profile 1).',
  );
}

export default defineConfig({
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-vue'],
  webExt: {
    chromiumProfile,
    chromiumPort: 9222,
  },
  manifest: {
    default_locale: 'en',
    permissions: ['webRequest', 'tabs', 'storage'],
    host_permissions: [
      '*://*/ifsapplications/projection/v1/*',
      '*://*/*/ifsapplications/projection/v1/*',
    ],
  },
});
