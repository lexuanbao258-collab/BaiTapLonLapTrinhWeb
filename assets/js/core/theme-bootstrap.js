'use strict';

/*
 * Applies the saved visual settings before the stylesheet can paint the page.
 * This small standalone script intentionally does not depend on CONFIG or
 * Storage because both are loaded later by the application bundle.
 */
(() => {
  const SESSION_KEY = 'taskflow_session_v1';
  const SETTINGS_KEY = 'taskflow_settings_v1';
  const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
  const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

  const parseStoredValue = (storageArea, key) => {
    try {
      const rawValue = storageArea.getItem(key);

      return rawValue ? JSON.parse(rawValue) : null;
    } catch {
      return null;
    }
  };

  const isValidSession = session => Boolean(
    session &&
    typeof session === 'object' &&
    !Array.isArray(session) &&
    USER_ID_PATTERN.test(String(session.userId || '').trim()) &&
    typeof session.createdAt === 'string' &&
    typeof session.remember === 'boolean'
  );

  const toRgb = color => {
    const value = Number.parseInt(color.slice(1), 16);

    return [
      (value >> 16) & 255,
      (value >> 8) & 255,
      value & 255
    ].join(', ');
  };

  const applyStoredTheme = () => {
    const persistentSession = parseStoredValue(localStorage, SESSION_KEY);
    const temporarySession = parseStoredValue(sessionStorage, SESSION_KEY);
    const hasPersistentSession = isValidSession(persistentSession);
    const hasTemporarySession = isValidSession(temporarySession);

    if (hasPersistentSession === hasTemporarySession) {
      return;
    }

    const session = hasPersistentSession ? persistentSession : temporarySession;
    const settingsKey = `${SETTINGS_KEY}__user_${session.userId}`;
    const settings = parseStoredValue(localStorage, settingsKey);

    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const theme = settings.theme === 'dark' ? 'dark' : 'light';
    const accent = String(settings.accent || '').trim();
    const root = document.documentElement;

    root.dataset.theme = theme;

    if (COLOR_PATTERN.test(accent)) {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-rgb', toRgb(accent));
    }
  };

  applyStoredTheme();
})();
