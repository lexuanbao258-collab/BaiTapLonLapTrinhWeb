'use strict';

const Storage = (() => {
  const AUTH_ERROR_MESSAGE = 'Phiên đăng nhập không hợp lệ.';
  const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
  const userScopedKeys = new Set(CONFIG.USER_SCOPED_STORAGE);

  const readEntry = (storageName, key) => {
    try {
      const storageArea = window[storageName];
      const rawValue = storageArea.getItem(key);

      if (rawValue === null) {
        return { ok: true, found: false, value: null };
      }

      return { ok: true, found: true, value: JSON.parse(rawValue) };
    } catch (error) {
      console.error(`Không thể đọc ${storageName}: ${key}`, error);
      return { ok: false, found: false, value: null, error };
    }
  };

  const readRawEntry = (storageName, key) => {
    try {
      const rawValue = window[storageName].getItem(key);

      return { ok: true, found: rawValue !== null, rawValue };
    } catch (error) {
      console.error(`Không thể đọc ${storageName}: ${key}`, error);
      return { ok: false, found: false, rawValue: null, error };
    }
  };

  const readFrom = (storageName, key, fallbackValue) => {
    const result = readEntry(storageName, key);

    return result.ok && result.found ? result.value : fallbackValue;
  };

  const writeTo = (storageName, key, value) => {
    try {
      window[storageName].setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      console.error(`Không thể lưu ${storageName}: ${key}`, error);
      return { ok: false, error };
    }
  };

  const writeRawToLocalStorage = (key, rawValue) => {
    try {
      window.localStorage.setItem(key, rawValue);
      return { ok: true };
    } catch (error) {
      console.error(`Unable to save LocalStorage: ${key}`, error);
      return { ok: false, error };
    }
  };

  const removeFrom = (storageName, key) => {
    try {
      window[storageName].removeItem(key);
      return { ok: true };
    } catch (error) {
      console.error(`Không thể xóa dữ liệu trong ${storageName}: ${key}`, error);
      return { ok: false, error };
    }
  };

  const isUserScopedKey = key => userScopedKeys.has(key);

  const isResolvedUserStorageKey = key => {
    const value = String(key || '');

    return CONFIG.USER_SCOPED_STORAGE.some(scopedKey => {
      return value.startsWith(`${scopedKey}__`);
    });
  };

  const normalizeUserId = userId => {
    const cleanUserId = String(userId || '').trim();

    return USER_ID_PATTERN.test(cleanUserId) ? cleanUserId : '';
  };

  const resolvedUserKey = (key, userId) => {
    const cleanUserId = normalizeUserId(userId);

    if (!cleanUserId) {
      throw new Error(AUTH_ERROR_MESSAGE);
    }

    return `${key}__user_${cleanUserId}`;
  };

  const userExists = userId => {
    const usersResult = readEntry('localStorage', CONFIG.STORAGE.USERS);

    return usersResult.ok &&
      usersResult.found &&
      Array.isArray(usersResult.value) &&
      usersResult.value.some(user => user?.id === userId);
  };

  const isValidSession = session => Boolean(
    session &&
    typeof session === 'object' &&
    !Array.isArray(session) &&
    normalizeUserId(session.userId) &&
    typeof session.createdAt === 'string' &&
    typeof session.remember === 'boolean'
  );

  const sessionEntry = storageName => {
    const result = readEntry(storageName, CONFIG.STORAGE.SESSION);

    if (!result.ok || !result.found) {
      return {
        ok: result.ok,
        present: false,
        valid: false,
        value: null
      };
    }

    return {
      ok: true,
      present: true,
      valid: isValidSession(result.value),
      value: result.value
    };
  };

  const getActiveSession = () => {
    const persistent = sessionEntry('localStorage');
    const temporary = sessionEntry('sessionStorage');

    if (!persistent.ok || !temporary.ok) {
      return null;
    }

    // A valid login creates exactly one session location. Ambiguous or stale
    // state must not accidentally expose another account's workspace.
    if (
      (persistent.present && !persistent.valid) ||
      (temporary.present && !temporary.valid) ||
      (persistent.present && temporary.present)
    ) {
      return null;
    }

    const session = persistent.present ? persistent.value : temporary.value;

    if (!session || !userExists(session.userId)) {
      return null;
    }

    return { ...session };
  };

  const activeUserId = () => getActiveSession()?.userId || '';

  const requireActiveUserId = () => {
    const userId = activeUserId();

    if (!userId) {
      throw new Error(AUTH_ERROR_MESSAGE);
    }

    return userId;
  };

  const resolveKey = key => {
    if (isResolvedUserStorageKey(key)) {
      throw new Error('Không được truy cập trực tiếp khóa dữ liệu người dùng đã resolve.');
    }

    if (!isUserScopedKey(key)) {
      return key;
    }

    return resolvedUserKey(key, requireActiveUserId());
  };

  // This intentionally reads only the active account's resolved key. Legacy
  // global keys are never returned or migrated to whichever user logs in.
  const inspect = key => readEntry('localStorage', resolveKey(key));

  const read = (key, fallbackValue) => {
    const result = inspect(key);

    return result.ok && result.found ? result.value : fallbackValue;
  };

  const write = (key, value) => writeTo('localStorage', resolveKey(key), value);
  const remove = key => removeFrom('localStorage', resolveKey(key));

  const isProtectedRawKey = key => {
    return isUserScopedKey(key) || isResolvedUserStorageKey(key);
  };

  const rawKeyError = key => ({
    ok: false,
    error: new Error(
      `Không được truy cập trực tiếp khóa dữ liệu người dùng: ${String(key)}`
    )
  });

  const rawRead = (key, fallbackValue) => {
    if (isProtectedRawKey(key)) {
      return fallbackValue;
    }

    return readFrom('localStorage', key, fallbackValue);
  };

  const rawInspect = key => {
    if (isProtectedRawKey(key)) {
      return rawKeyError(key);
    }

    return readEntry('localStorage', key);
  };

  const rawWrite = (key, value) => {
    if (isProtectedRawKey(key)) {
      return rawKeyError(key);
    }

    return writeTo('localStorage', key, value);
  };

  const rawRemove = key => {
    if (isProtectedRawKey(key)) {
      return rawKeyError(key);
    }

    return removeFrom('localStorage', key);
  };

  const sessionRead = (key, fallbackValue) => readFrom(
    'sessionStorage',
    key,
    fallbackValue
  );
  const sessionInspect = key => readEntry('sessionStorage', key);
  const sessionWrite = (key, value) => writeTo('sessionStorage', key, value);
  const sessionRemove = key => removeFrom('sessionStorage', key);

  const restoreRawValues = entries => {
    let restored = true;

    entries.forEach(entry => {
      try {
        if (entry.rawValue === null) {
          window.localStorage.removeItem(entry.key);
        } else {
          window.localStorage.setItem(entry.key, entry.rawValue);
        }
      } catch (error) {
        restored = false;
        console.error(`Không thể khôi phục LocalStorage sau lỗi: ${entry.key}`, error);
      }
    });

    return restored;
  };

  const removeLocalStorageKeys = keys => {
    const removedValues = [];

    for (const key of keys) {
      const rawResult = readRawEntry('localStorage', key);

      if (!rawResult.ok) {
        restoreRawValues(removedValues);
        return { ok: false, error: rawResult.error };
      }

      const removeResult = removeFrom('localStorage', key);

      if (!removeResult.ok) {
        restoreRawValues(removedValues);
        return removeResult;
      }

      removedValues.push({ key, rawValue: rawResult.rawValue });
    }

    return { ok: true };
  };

  const defaultUserData = () => {
    const createdAt = new Date().toISOString();

    return {
      [CONFIG.STORAGE.TASKS]: [],
      [CONFIG.STORAGE.CATEGORIES]: CONFIG.DEFAULT_CATEGORIES.map(category => ({
        ...category,
        createdAt
      })),
      [CONFIG.STORAGE.SETTINGS]: { ...CONFIG.DEFAULT_SETTINGS },
      [CONFIG.STORAGE.ACTIVITIES]: [],
      [CONFIG.STORAGE.BACKUPS]: [],
      [CONFIG.STORAGE.SEEDED]: false
    };
  };

  // This API accepts an explicit user id so registration can initialize a
  // workspace before the new account has a session.
  const initializeUserData = (userId, options = {}) => {
    const cleanUserId = normalizeUserId(userId);

    if (!cleanUserId) {
      return {
        ok: false,
        error: new Error('Không tìm thấy mã tài khoản để khởi tạo dữ liệu.')
      };
    }

    const initialData = defaultUserData();
    const previousEntries = [];
    const pendingWrites = [];

    for (const key of CONFIG.USER_SCOPED_STORAGE) {
      const scopedKey = resolvedUserKey(key, cleanUserId);
      const rawResult = readRawEntry('localStorage', scopedKey);

      if (!rawResult.ok) {
        return { ok: false, error: rawResult.error };
      }

      previousEntries.push({ key: scopedKey, rawValue: rawResult.rawValue });

      if (rawResult.found && options.requireEmpty) {
        return {
          ok: false,
          error: new Error('Workspace của tài khoản mới đã tồn tại.')
        };
      }

      if (!rawResult.found) {
        pendingWrites.push({ key: scopedKey, value: initialData[key] });
      }
    }

    for (const entry of pendingWrites) {
      const writeResult = writeTo('localStorage', entry.key, entry.value);

      if (!writeResult.ok) {
        const rollbackOk = restoreRawValues(previousEntries);

        return { ok: false, error: writeResult.error, rollbackOk };
      }
    }

    return { ok: true, initialized: pendingWrites.length > 0 };
  };

  const clearUserData = userId => {
    const cleanUserId = normalizeUserId(userId);

    if (!cleanUserId) {
      return {
        ok: false,
        error: new Error('Thiếu mã tài khoản cần xóa dữ liệu.')
      };
    }

    return removeLocalStorageKeys(
      CONFIG.USER_SCOPED_STORAGE.map(key => resolvedUserKey(key, cleanUserId))
    );
  };

  const clearAppData = () => removeLocalStorageKeys(
    CONFIG.USER_SCOPED_STORAGE.map(resolveKey)
  );

  const currentUserStorageKeys = () => CONFIG.USER_SCOPED_STORAGE.map(resolveKey);

  const hasValidLegacySnapshot = value => Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.entries &&
    typeof value.entries === 'object' &&
    !Array.isArray(value.entries)
  );

  const readLegacySnapshotEntries = () => {
    const snapshotResult = readEntry(
      'localStorage',
      CONFIG.STORAGE.LEGACY_SNAPSHOT
    );

    if (!snapshotResult.ok) {
      return { ok: false, entries: [], error: snapshotResult.error };
    }

    if (!snapshotResult.found) {
      return { ok: true, entries: [], found: false };
    }

    if (!hasValidLegacySnapshot(snapshotResult.value)) {
      return {
        ok: false,
        entries: [],
        error: new Error('Legacy data snapshot is invalid.')
      };
    }

    const entries = CONFIG.USER_SCOPED_STORAGE
      .map(key => ({ key, rawValue: snapshotResult.value.entries[key] }))
      .filter(entry => typeof entry.rawValue === 'string');

    return { ok: true, entries, found: true };
  };

  const readLegacyEntries = () => {
    const globalEntries = [];

    for (const key of CONFIG.USER_SCOPED_STORAGE) {
      const rawResult = readRawEntry('localStorage', key);

      if (!rawResult.ok) {
        return { ok: false, entries: [], error: rawResult.error };
      }

      if (rawResult.found) {
        globalEntries.push({ key, rawValue: rawResult.rawValue });
      }
    }

    if (globalEntries.length) {
      return { ok: true, entries: globalEntries, source: 'legacy-global' };
    }

    const snapshotResult = readLegacySnapshotEntries();

    if (!snapshotResult.ok) {
      return snapshotResult;
    }

    return {
      ok: true,
      entries: snapshotResult.entries,
      source: snapshotResult.entries.length ? 'legacy-snapshot' : 'none'
    };
  };

  const migrateLegacyDataToActiveUser = () => {
    const markerResult = readEntry(
      'localStorage',
      CONFIG.STORAGE.LEGACY_MIGRATION
    );

    if (!markerResult.ok) {
      return { ok: false, error: markerResult.error };
    }

    if (
      markerResult.found &&
      markerResult.value?.version === CONFIG.LEGACY_MIGRATION_VERSION &&
      markerResult.value?.completed === true
    ) {
      return { ok: true, migrated: false, alreadyCompleted: true };
    }

    const userId = activeUserId();

    if (!userId) {
      return { ok: false, error: new Error(AUTH_ERROR_MESSAGE) };
    }

    const legacyResult = readLegacyEntries();

    if (!legacyResult.ok) {
      return legacyResult;
    }

    if (!legacyResult.entries.length) {
      return { ok: true, migrated: false, noLegacyData: true };
    }

    const entriesToWrite = [];
    const invalidKeys = [];
    const conflicts = [];

    for (const entry of legacyResult.entries) {
      try {
        JSON.parse(entry.rawValue);
      } catch (error) {
        invalidKeys.push(entry.key);
        continue;
      }

      const targetKey = resolvedUserKey(entry.key, userId);
      const targetResult = readRawEntry('localStorage', targetKey);

      if (!targetResult.ok) {
        return { ok: false, error: targetResult.error };
      }

      if (targetResult.found && targetResult.rawValue !== entry.rawValue) {
        conflicts.push(entry.key);
        continue;
      }

      if (!targetResult.found) {
        entriesToWrite.push({
          key: targetKey,
          rawValue: entry.rawValue,
          previousRawValue: targetResult.rawValue
        });
      }
    }

    // A legacy workspace has no reliable owner marker. Never merge it into an
    // already populated scoped workspace: retain the original values for a
    // deliberate recovery instead of risking cross-account data exposure.
    if (conflicts.length) {
      return {
        ok: true,
        migrated: false,
        requiresRecovery: true,
        conflictKeys: conflicts,
        invalidKeys
      };
    }

    const previousEntries = entriesToWrite.map(entry => ({
      key: entry.key,
      rawValue: entry.previousRawValue
    }));

    for (const entry of entriesToWrite) {
      const writeResult = writeRawToLocalStorage(entry.key, entry.rawValue);

      if (!writeResult.ok) {
        restoreRawValues(previousEntries);
        return { ok: false, error: writeResult.error };
      }
    }

    const migrationWriteResult = writeTo(
      'localStorage',
      CONFIG.STORAGE.LEGACY_MIGRATION,
      {
        version: CONFIG.LEGACY_MIGRATION_VERSION,
        completed: true,
        migratedAt: new Date().toISOString(),
        userId,
        source: legacyResult.source,
        migratedKeys: entriesToWrite.map(entry => entry.key),
        invalidKeys
      }
    );

    if (!migrationWriteResult.ok) {
      restoreRawValues(previousEntries);
      return { ok: false, error: migrationWriteResult.error };
    }

    return {
      ok: true,
      migrated: entriesToWrite.length > 0,
      source: legacyResult.source,
      invalidKeys
    };
  };

  const cleanupLegacyData = () => {
    const markerResult = readEntry('localStorage', CONFIG.STORAGE.LEGACY_CLEANUP);

    if (
      markerResult.ok &&
      markerResult.found &&
      markerResult.value?.version === CONFIG.LEGACY_CLEANUP_VERSION &&
      markerResult.value?.completed === true
    ) {
      return { ok: true, cleaned: false, alreadyCompleted: true };
    }

    const legacyEntries = [];

    for (const key of CONFIG.USER_SCOPED_STORAGE) {
      const rawResult = readRawEntry('localStorage', key);

      if (!rawResult.ok) {
        return { ok: false, error: rawResult.error };
      }

      if (rawResult.found) {
        legacyEntries.push({ key, rawValue: rawResult.rawValue });
      }
    }

    if (legacyEntries.length) {
      const snapshotResult = readEntry(
        'localStorage',
        CONFIG.STORAGE.LEGACY_SNAPSHOT
      );

      const snapshotIsMalformed = snapshotResult.found &&
        !hasValidLegacySnapshot(snapshotResult.value);

      if (!snapshotResult.ok || snapshotIsMalformed) {
        return {
          ok: false,
          error: snapshotResult.error || new Error(
            'Snapshot dữ liệu legacy hiện có không hợp lệ.'
          )
        };
      }

      const existingEntries = snapshotResult.found ? snapshotResult.value.entries : {};
      const snapshot = {
        version: CONFIG.LEGACY_CLEANUP_VERSION,
        createdAt: new Date().toISOString(),
        source: 'legacy-unscoped-user-data',
        entries: {
          ...existingEntries,
          ...Object.fromEntries(legacyEntries.map(entry => [
            entry.key,
            entry.rawValue
          ]))
        }
      };
      const backupResult = writeTo(
        'localStorage',
        CONFIG.STORAGE.LEGACY_SNAPSHOT,
        snapshot
      );

      if (!backupResult.ok) {
        return { ok: false, error: backupResult.error };
      }

      const removeResult = removeLocalStorageKeys(legacyEntries.map(entry => entry.key));

      if (!removeResult.ok) {
        return removeResult;
      }
    }

    const markerWriteResult = writeTo(
      'localStorage',
      CONFIG.STORAGE.LEGACY_CLEANUP,
      {
        version: CONFIG.LEGACY_CLEANUP_VERSION,
        completed: true,
        cleanedAt: new Date().toISOString(),
        snapshotKey: legacyEntries.length ? CONFIG.STORAGE.LEGACY_SNAPSHOT : ''
      }
    );

    if (!markerWriteResult.ok) {
      if (legacyEntries.length) {
        restoreRawValues(legacyEntries);
      }

      return { ok: false, error: markerWriteResult.error };
    }

    return {
      ok: true,
      cleaned: legacyEntries.length > 0,
      snapshotKey: legacyEntries.length ? CONFIG.STORAGE.LEGACY_SNAPSHOT : ''
    };
  };

  return {
    read,
    inspect,
    write,
    remove,
    rawRead,
    rawInspect,
    rawWrite,
    rawRemove,
    sessionRead,
    sessionInspect,
    sessionWrite,
    sessionRemove,
    getActiveSession,
    activeUserId,
    requireActiveUserId,
    resolveKey,
    initializeUserData,
    clearAppData,
    clearUserData,
    currentUserStorageKeys,
    migrateLegacyDataToActiveUser,
    cleanupLegacyData
  };
})();
