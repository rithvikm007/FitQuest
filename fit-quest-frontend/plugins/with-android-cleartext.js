const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidCleartext(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults?.manifest;
    const app = manifest?.application?.[0];

    if (!app) {
      return configWithManifest;
    }

    app.$ = app.$ || {};
    app.$['android:usesCleartextTraffic'] = 'true';

    return configWithManifest;
  });
};
