'use strict';

// The information tab deliberately stays presentation-only. Settings, backup
// and LocalStorage work belong to SettingsPage and their dedicated services.
const AboutPage = (() => {
  const init = () => {
    if (App.page !== 'about') {
      return;
    }

    const version = document.querySelector('#appVersion');

    if (version) {
      version.textContent = CONFIG.VERSION;
    }
  };

  init();
  return { init };
})();
