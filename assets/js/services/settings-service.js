'use strict';

const SettingsService = (() => {
  const STORAGE_ERROR =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';

  const getDefaultSettings = () => ({ ...CONFIG.DEFAULT_SETTINGS });

  const getSettings = () => {
    const settings = Storage.read(CONFIG.STORAGE.SETTINGS, getDefaultSettings());

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return getDefaultSettings();
    }

    return {
      ...getDefaultSettings(),
      ...settings
    };
  };

  const saveSettings = patch => {
    const nextSettings = {
      ...getSettings(),
      ...patch
    };
    const result = Storage.write(CONFIG.STORAGE.SETTINGS, nextSettings);

    return result.ok ? nextSettings : null;
  };

  const storageError = () => ({
    ok: false,
    errors: { general: STORAGE_ERROR },
    message: STORAGE_ERROR
  });

  return {
    getDefaultSettings,
    getSettings,
    saveSettings,
    storageError
  };
})();
