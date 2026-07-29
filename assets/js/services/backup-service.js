'use strict';

const BackupService = (() => {
  const STORAGE_ERROR =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';
  const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;
  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
  const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
  const VALID_STATUSES = new Set(['todo', 'progress', 'done']);
  const VALID_VIEW_MODES = new Set(['list', 'grid']);
  const MAX_BACKUPS = 5;

  const isPlainObject = value => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  };

  const cleanText = (value, maxLength) => {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, maxLength);
  };

  const cleanSourceId = value => typeof value === 'string' ? value.trim() : '';

  const createUniqueId = (preferred, prefix, usedIds) => {
    let candidate = cleanSourceId(preferred);

    if (!SAFE_ID_PATTERN.test(candidate) || usedIds.has(candidate)) {
      do {
        candidate = Utils.uid(prefix);
      } while (usedIds.has(candidate));
    }

    usedIds.add(candidate);
    return candidate;
  };

  const normalizeDateTime = (value, fallback) => {
    if (typeof value !== 'string' || !value.trim()) {
      return fallback;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  };

  const normalizeEstimate = value => {
    const estimate = Number(value);

    if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1000) {
      return 0;
    }

    return Number(estimate.toFixed(2));
  };

  const normalizeProgress = (status, value) => {
    const rawProgress = Number(value);
    let progress = Number.isFinite(rawProgress) ?
      Math.round(Utils.clamp(rawProgress, 0, 100)) : 0;
    let repaired = !Number.isFinite(rawProgress);

    if (status === 'done' && progress !== 100) {
      progress = 100;
      repaired = true;
    }

    if (status === 'todo' && progress >= 100) {
      progress = 0;
      repaired = true;
    }

    if (status === 'progress' && progress >= 100) {
      progress = 25;
      repaired = true;
    }

    return { progress, repaired };
  };

  const normalizeTags = value => {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();

    return source
      .map(tag => cleanText(String(tag), 40))
      .filter(tag => {
        const key = Utils.normalize(tag);

        if (!key || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(0, 8);
  };

  const normalizeSubtasks = subtasks => {
    const usedIds = new Set();

    return (Array.isArray(subtasks) ? subtasks : [])
      .filter(subtask => isPlainObject(subtask))
      .map(subtask => ({
        title: cleanText(subtask.title, 120),
        done: Boolean(subtask.done),
        id: createUniqueId(subtask.id, 'sub', usedIds)
      }))
      .filter(subtask => subtask.title)
      .slice(0, 50);
  };

  const normalizeCategories = source => {
    if (source === undefined) {
      return {
        provided: false,
        categories: [],
        sourceIdMap: new Map(),
        skipped: 0,
        colorsFixed: 0
      };
    }

    if (!Array.isArray(source)) {
      return {
        provided: true,
        categories: [],
        sourceIdMap: new Map(),
        skipped: 1,
        colorsFixed: 0
      };
    }

    const categories = [];
    const sourceIdMap = new Map();
    const idsByName = new Map();
    const usedIds = new Set();
    const now = new Date().toISOString();
    let skipped = 0;
    let colorsFixed = 0;

    source.forEach(item => {
      if (!isPlainObject(item)) {
        skipped += 1;
        return;
      }

      const name = cleanText(item.name, 40);

      if (!name) {
        skipped += 1;
        return;
      }

      const sourceId = cleanSourceId(item.id);
      const normalizedName = Utils.normalize(name);
      const duplicateNameId = idsByName.get(normalizedName);

      if (duplicateNameId) {
        if (sourceId && !sourceIdMap.has(sourceId)) {
          sourceIdMap.set(sourceId, duplicateNameId);
        }

        skipped += 1;
        return;
      }

      const id = createUniqueId(sourceId, 'cat', usedIds);
      const hasValidColor = HEX_COLOR_PATTERN.test(String(item.color || '').trim());
      const color = hasValidColor ?
        String(item.color).trim().toLowerCase() : CONFIG.DEFAULT_CATEGORY_COLOR;

      if (!hasValidColor) {
        colorsFixed += 1;
      }

      const category = {
        id,
        name,
        color,
        icon: cleanText(item.icon, 12) || '📁',
        createdAt: normalizeDateTime(item.createdAt, now)
      };
      const updatedAt = normalizeDateTime(item.updatedAt, '');

      if (updatedAt) {
        category.updatedAt = updatedAt;
      }

      categories.push(category);
      idsByName.set(normalizedName, id);

      if (sourceId && !sourceIdMap.has(sourceId)) {
        sourceIdMap.set(sourceId, id);
      }
    });

    return { provided: true, categories, sourceIdMap, skipped, colorsFixed };
  };

  const normalizeTasks = (source, sourceCategoryIds) => {
    if (!Array.isArray(source)) {
      return { tasks: [], skipped: 0, idsRegenerated: 0, progressFixed: 0 };
    }

    const tasks = [];
    const usedIds = new Set();
    const now = new Date().toISOString();
    let skipped = 0;
    let idsRegenerated = 0;
    let progressFixed = 0;

    source.forEach(item => {
      if (!isPlainObject(item)) {
        skipped += 1;
        return;
      }

      const title = cleanText(item.title, 120);
      const description = cleanText(item.description, 1000);
      const deadline = cleanText(item.deadline, 10);
      const priority = cleanText(item.priority, 20);
      const status = cleanText(item.status, 20);

      if (
        !title ||
        !description ||
        !Validators.isValidISODate(deadline) ||
        !VALID_PRIORITIES.has(priority) ||
        !VALID_STATUSES.has(status)
      ) {
        skipped += 1;
        return;
      }

      const sourceId = cleanSourceId(item.id);
      const id = createUniqueId(sourceId, 'task', usedIds);

      if (id !== sourceId) {
        idsRegenerated += 1;
      }

      const progressResult = normalizeProgress(status, item.progress);

      if (progressResult.repaired) {
        progressFixed += 1;
      }

      const categorySourceId = cleanSourceId(item.categoryId);
      const categoryId = sourceCategoryIds.get(categorySourceId) || categorySourceId;
      const createdAt = normalizeDateTime(item.createdAt, now);
      const updatedAt = normalizeDateTime(item.updatedAt, createdAt);

      tasks.push({
        id,
        title,
        description,
        deadline,
        priority,
        status,
        categoryId,
        tags: normalizeTags(item.tags),
        pinned: Boolean(item.pinned),
        estimate: normalizeEstimate(item.estimate),
        progress: progressResult.progress,
        subtasks: normalizeSubtasks(item.subtasks),
        notes: cleanText(item.notes, 3000),
        createdAt,
        updatedAt,
        completedAt: status === 'done' ?
          normalizeDateTime(item.completedAt, updatedAt) : null
      });
    });

    return { tasks, skipped, idsRegenerated, progressFixed };
  };

  const normalizeSettings = settings => {
    if (!isPlainObject(settings)) {
      return null;
    }

    const current = SettingsService.getSettings();
    const theme = ['light', 'dark'].includes(settings.theme) ? settings.theme : current.theme;
    const accent = HEX_COLOR_PATTERN.test(String(settings.accent || '').trim()) ?
      String(settings.accent).trim().toLowerCase() : current.accent;
    const viewMode = VALID_VIEW_MODES.has(settings.viewMode) ?
      settings.viewMode : current.viewMode;

    return {
      ...current,
      theme,
      accent,
      viewMode,
      compact: typeof settings.compact === 'boolean' ? settings.compact : Boolean(current.compact),
      sidebarCollapsed: typeof settings.sidebarCollapsed === 'boolean' ?
        settings.sidebarCollapsed : Boolean(current.sidebarCollapsed)
    };
  };

  const normalizeImportPayload = data => {
    if (!isPlainObject(data) || !Array.isArray(data.tasks)) {
      return {
        ok: false,
        message: 'Tệp sao lưu không có danh sách công việc hợp lệ.'
      };
    }

    const categoryResult = normalizeCategories(data.categories);
    const taskResult = normalizeTasks(data.tasks, categoryResult.sourceIdMap);

    if (data.tasks.length && !taskResult.tasks.length) {
      return {
        ok: false,
        message: 'Không tìm thấy công việc hợp lệ trong file.',
        tasksSkipped: taskResult.skipped,
        categoriesSkipped: categoryResult.skipped
      };
    }

    if (!data.tasks.length && !categoryResult.categories.length && !normalizeSettings(data.settings)) {
      return {
        ok: false,
        message: 'File không có dữ liệu hợp lệ để nhập.'
      };
    }

    return {
      ok: true,
      tasks: taskResult.tasks,
      categories: categoryResult.categories,
      categoriesProvided: categoryResult.provided,
      categorySourceIdMap: categoryResult.sourceIdMap,
      settings: normalizeSettings(data.settings),
      taskValidationSkipped: taskResult.skipped,
      categoryValidationSkipped: categoryResult.skipped,
      taskIdsRegenerated: taskResult.idsRegenerated,
      taskProgressFixed: taskResult.progressFixed,
      categoryColorsFixed: categoryResult.colorsFixed
    };
  };

  const createCategoryPlan = (currentCategories, normalized, mode) => {
    if (mode === 'overwrite' && normalized.categoriesProvided) {
      const importIdMap = new Map();

      normalized.categories.forEach(category => {
        importIdMap.set(category.id, category.id);
      });

      return {
        categories: normalized.categories.map(category => ({ ...category })),
        importIdMap,
        categoriesAdded: normalized.categories.length,
        categoriesMatched: 0
      };
    }

    const categories = currentCategories.map(category => ({ ...category }));
    const usedIds = new Set();
    const idsByName = new Map();
    const importIdMap = new Map();

    categories.forEach(category => {
      const id = cleanSourceId(category?.id);
      const normalizedName = Utils.normalize(category?.name);

      if (id) {
        usedIds.add(id);
      }

      if (normalizedName && !idsByName.has(normalizedName)) {
        idsByName.set(normalizedName, id);
      }
    });

    let categoriesAdded = 0;
    let categoriesMatched = 0;

    normalized.categories.forEach(category => {
      const normalizedName = Utils.normalize(category.name);
      const existingId = idsByName.get(normalizedName);

      if (existingId) {
        importIdMap.set(category.id, existingId);
        categoriesMatched += 1;
        return;
      }

      const id = createUniqueId(category.id, 'cat', usedIds);
      const nextCategory = { ...category, id };

      categories.push(nextCategory);
      idsByName.set(normalizedName, id);
      importIdMap.set(category.id, id);
      categoriesAdded += 1;
    });

    return { categories, importIdMap, categoriesAdded, categoriesMatched };
  };

  const createTaskPlan = (currentTasks, normalizedTasks, categories, importIdMap, mode) => {
    const validCategoryIds = new Set(
      categories.map(category => cleanSourceId(category?.id)).filter(Boolean)
    );
    const tasks = mode === 'merge' ? currentTasks.map(task => ({ ...task })) : [];
    const existingIds = new Set(tasks.map(task => cleanSourceId(task?.id)).filter(Boolean));
    let tasksAdded = 0;
    let duplicateTaskIds = 0;

    normalizedTasks.forEach(task => {
      if (mode === 'merge' && existingIds.has(task.id)) {
        duplicateTaskIds += 1;
        return;
      }

      const mappedCategoryId = importIdMap.get(task.categoryId) || task.categoryId;
      const categoryId = validCategoryIds.has(mappedCategoryId) ? mappedCategoryId : '';

      tasks.push({ ...task, categoryId });
      existingIds.add(task.id);
      tasksAdded += 1;
    });

    return { tasks, tasksAdded, duplicateTaskIds };
  };

  const prepareImport = (data, options = {}) => {
    const normalized = normalizeImportPayload(data);

    if (!normalized.ok) {
      return normalized;
    }

    const mode = options.mode === 'overwrite' || options.merge === false ?
      'overwrite' : 'merge';
    const snapshot = {
      tasks: TaskService.getTasks(),
      categories: CategoryService.getAll(),
      settings: SettingsService.getSettings(),
      activities: ActivityService.getActivityList()
    };
    const categoryPlan = createCategoryPlan(snapshot.categories, normalized, mode);
    const taskPlan = createTaskPlan(
      snapshot.tasks,
      normalized.tasks,
      categoryPlan.categories,
      categoryPlan.importIdMap,
      mode
    );

    return {
      ok: true,
      mode,
      normalized,
      snapshot,
      categories: categoryPlan.categories,
      tasks: taskPlan.tasks,
      settings: normalized.settings,
      tasksAdded: taskPlan.tasksAdded,
      tasksSkipped: normalized.taskValidationSkipped + taskPlan.duplicateTaskIds,
      duplicateTaskIds: taskPlan.duplicateTaskIds,
      categoriesAdded: categoryPlan.categoriesAdded,
      categoriesMatched: categoryPlan.categoriesMatched,
      categoriesSkipped: normalized.categoryValidationSkipped
    };
  };

  const writeChangesWithRollback = changes => {
    for (let index = 0; index < changes.length; index += 1) {
      const change = changes[index];
      const result = Storage.write(change.key, change.value);

      if (result?.ok) {
        continue;
      }

      let rollbackOk = true;

      for (let rollbackIndex = index; rollbackIndex >= 0; rollbackIndex -= 1) {
        const rollbackChange = changes[rollbackIndex];
        const rollbackResult = Storage.write(
          rollbackChange.key,
          rollbackChange.previous
        );

        rollbackOk = rollbackOk && Boolean(rollbackResult?.ok);
      }

      return { ok: false, rollbackOk, error: result?.error };
    }

    return { ok: true, rollbackOk: true };
  };

  const importData = (data, options = {}) => {
    const prepared = prepareImport(data, options);

    if (!prepared.ok) {
      return prepared;
    }

    const activity = ActivityService.createActivity(
      options.activityType || 'import',
      options.activityText || (
        `Đã ${prepared.mode === 'merge' ? 'gộp' : 'ghi đè'} ` +
        `${prepared.tasksAdded} công việc và ${prepared.categoriesAdded} danh mục từ tệp sao lưu`
      )
    );
    const activities = ActivityService.prependActivity(activity, prepared.snapshot.activities);
    const changes = [{
      key: CONFIG.STORAGE.TASKS,
      value: prepared.tasks,
      previous: prepared.snapshot.tasks
    }, {
      key: CONFIG.STORAGE.CATEGORIES,
      value: prepared.categories,
      previous: prepared.snapshot.categories
    }];

    if (prepared.settings) {
      changes.push({
        key: CONFIG.STORAGE.SETTINGS,
        value: prepared.settings,
        previous: prepared.snapshot.settings
      });
    }

    changes.push({
      key: CONFIG.STORAGE.ACTIVITIES,
      value: activities,
      previous: prepared.snapshot.activities
    });

    const writeResult = writeChangesWithRollback(changes);

    if (!writeResult.ok) {
      return {
        ok: false,
        message: `${STORAGE_ERROR}${writeResult.rollbackOk ?
          ' Dữ liệu cũ đã được khôi phục.' :
          ' Không thể khôi phục đầy đủ dữ liệu cũ; hãy tải lại trang và kiểm tra bản sao lưu.'}`
      };
    }

    window.dispatchEvent(new CustomEvent('taskflow:data-changed', {
      detail: { type: 'import', mode: prepared.mode }
    }));

    return {
      ok: true,
      mode: prepared.mode,
      tasksAdded: prepared.tasksAdded,
      tasksSkipped: prepared.tasksSkipped,
      duplicateTaskIds: prepared.duplicateTaskIds,
      categoriesAdded: prepared.categoriesAdded,
      categoriesMatched: prepared.categoriesMatched,
      categoriesSkipped: prepared.categoriesSkipped,
      taskIdsRegenerated: prepared.normalized.taskIdsRegenerated,
      taskProgressFixed: prepared.normalized.taskProgressFixed,
      categoryColorsFixed: prepared.normalized.categoryColorsFixed
    };
  };

  const previewImport = (data, options = {}) => {
    const prepared = prepareImport(data, options);

    if (!prepared.ok) {
      return prepared;
    }

    return {
      ok: true,
      mode: prepared.mode,
      tasksAdded: prepared.tasksAdded,
      tasksSkipped: prepared.tasksSkipped,
      categoriesAdded: prepared.categoriesAdded,
      categoriesMatched: prepared.categoriesMatched,
      categoriesSkipped: prepared.categoriesSkipped,
      taskIdsRegenerated: prepared.normalized.taskIdsRegenerated,
      taskProgressFixed: prepared.normalized.taskProgressFixed,
      categoryColorsFixed: prepared.normalized.categoryColorsFixed
    };
  };

  const exportData = () => ({
    app: CONFIG.APP_NAME,
    version: CONFIG.VERSION,
    exportedAt: new Date().toISOString(),
    tasks: TaskService.getTasks(),
    categories: CategoryService.getAll(),
    settings: SettingsService.getSettings()
  });

  const getBackups = () => {
    const backups = Storage.read(CONFIG.STORAGE.BACKUPS, []);

    return Array.isArray(backups) ? backups : [];
  };

  const createBackup = (name = '') => {
    const previousBackups = getBackups();
    const backup = {
      id: Utils.uid('backup'),
      name: name || `Sao lưu ${Utils.formatDateTime(new Date().toISOString())}`,
      createdAt: new Date().toISOString(),
      data: exportData()
    };
    const nextBackups = [backup, ...previousBackups].slice(0, MAX_BACKUPS);

    if (!Storage.write(CONFIG.STORAGE.BACKUPS, nextBackups).ok) {
      return null;
    }

    if (!ActivityService.logActivity(
        'backup',
        `Đã tạo bản sao lưu “${backup.name}”`,
        backup.id
      )) {
      const rollbackResult = Storage.write(CONFIG.STORAGE.BACKUPS, previousBackups);

      if (!rollbackResult.ok) {
        console.error('Không thể hoàn tác bản sao lưu sau lỗi ghi nhật ký.');
      }

      return null;
    }

    return backup;
  };

  const restoreBackup = id => {
    const backup = getBackups().find(item => item?.id === id);

    if (!backup?.data) {
      return false;
    }

    return importData(backup.data, {
      mode: 'overwrite',
      activityType: 'restore',
      activityText: `Đã khôi phục “${backup.name}”`
    }).ok;
  };

  const deleteBackup = id => {
    const backups = getBackups();
    const nextBackups = backups.filter(item => item?.id !== id);

    return Storage.write(CONFIG.STORAGE.BACKUPS, nextBackups).ok;
  };

  const captureCurrentUserData = () => {
    return CONFIG.USER_SCOPED_STORAGE.map(key => {
      const result = Storage.inspect(key);

      return {
        key,
        found: Boolean(result.ok && result.found),
        value: result.value
      };
    });
  };

  const restoreCurrentUserData = snapshot => {
    let restored = true;

    snapshot.forEach(entry => {
      const result = entry.found ?
        Storage.write(entry.key, entry.value) :
        Storage.remove(entry.key);

      restored = restored && Boolean(result?.ok);
    });

    return restored;
  };

  const clearAllData = () => {
    const userId = Storage.activeUserId();

    if (!userId) {
      return { ok: false, message: 'Phiên đăng nhập đã hết hạn.' };
    }

    const snapshot = captureCurrentUserData();
    const clearResult = Storage.clearAppData();

    if (!clearResult.ok) {
      restoreCurrentUserData(snapshot);
      return { ok: false, message: STORAGE_ERROR };
    }

    const initializeResult = Storage.initializeUserData(userId);
    const seedFlagResult = initializeResult.ok ? Storage.write(
      CONFIG.STORAGE.SEEDED,
      WorkspaceService.isDemoAccount()
    ) : initializeResult;

    if (!initializeResult.ok || !seedFlagResult.ok) {
      const rollbackOk = restoreCurrentUserData(snapshot);

      return {
        ok: false,
        message: `${STORAGE_ERROR}${rollbackOk ?
          ' Dữ liệu cũ đã được khôi phục.' :
          ' Không thể khôi phục đầy đủ dữ liệu cũ.'}`
      };
    }

    window.dispatchEvent(new CustomEvent('taskflow:data-changed', {
      detail: { type: 'clear_all_data' }
    }));

    return { ok: true };
  };

  const downloadBackup = () => {
    const data = exportData();

    Utils.downloadJSON(data, `taskflow-backup-${Utils.todayISO()}.json`);
    return data;
  };

  return {
    exportData,
    downloadBackup,
    previewImport,
    importData,
    createBackup,
    getBackups,
    restoreBackup,
    deleteBackup,
    clearAllData
  };
})();
