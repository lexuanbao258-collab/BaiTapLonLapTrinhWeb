'use strict';

const TaskService = (() => {
  const STORAGE_ERROR =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';
  const VALID_STATUSES = new Set(['todo', 'progress', 'done']);

  const storageError = () => ({
    ok: false,
    errors: { general: STORAGE_ERROR },
    message: STORAGE_ERROR
  });

  const repairTaskProgress = task => {
    if (!task || typeof task !== 'object') {
      return task;
    }

    if (task.status === 'done' && Number(task.progress) !== 100) {
      return { ...task, progress: 100 };
    }

    if (task.status === 'todo' && Number(task.progress) >= 100) {
      return { ...task, progress: 0 };
    }

    if (task.status === 'progress' && Number(task.progress) >= 100) {
      return { ...task, progress: 25 };
    }

    return task;
  };

  const getTasks = () => {
    const storedTasks = Storage.read(CONFIG.STORAGE.TASKS, []);

    if (!Array.isArray(storedTasks)) {
      return [];
    }

    return storedTasks
      .filter(task => task && typeof task === 'object')
      .map(repairTaskProgress);
  };

  const saveTasks = tasks => {
    return Storage.write(CONFIG.STORAGE.TASKS, Array.isArray(tasks) ? tasks : []);
  };

  const repairStoredProgress = () => {
    const storedResult = Storage.inspect(CONFIG.STORAGE.TASKS);

    if (!storedResult.ok) {
      return false;
    }

    if (!storedResult.found) {
      return true;
    }

    if (!Array.isArray(storedResult.value)) {
      console.error('Dữ liệu công việc trong LocalStorage không hợp lệ.');
      return false;
    }

    let changed = false;
    const repairedTasks = storedResult.value.map(task => {
      const repairedTask = repairTaskProgress(task);

      if (repairedTask !== task) {
        changed = true;
      }

      return repairedTask;
    });

    return !changed || saveTasks(repairedTasks).ok;
  };

  const getTaskById = id => {
    return getTasks().find(task => task.id === id) || null;
  };

  const normalizeSubtasks = subtasks => {
    if (!Array.isArray(subtasks)) {
      return [];
    }

    return subtasks
      .filter(subtask => String(subtask?.title || '').trim())
      .slice(0, 50)
      .map(subtask => ({
        id: String(subtask.id || Utils.uid('sub')),
        title: String(subtask.title).trim().slice(0, 120),
        done: Boolean(subtask.done)
      }));
  };

  const normalizeTags = tags => {
    const tagList = Array.isArray(tags) ? tags : String(tags || '').split(',');

    return tagList
      .map(tag => String(tag).trim())
      .filter(Boolean)
      .slice(0, 8);
  };

  const incompleteProgress = (status, progress) => {
    const safeProgress = Utils.clamp(progress, 0, 100);

    if (safeProgress < 100) {
      return safeProgress;
    }

    return status === 'progress' ? 25 : 0;
  };

  const calculateProgress = (input, subtasks, preferInputProgress) => {
    if (input.status === 'done') {
      return 100;
    }

    let progress = input.progress ?? 0;

    if (subtasks.length && !preferInputProgress) {
      const completedCount = subtasks.filter(subtask => subtask.done).length;

      progress = Math.round(completedCount / subtasks.length * 100);
    }

    return incompleteProgress(input.status, progress);
  };

  // Normalization is deliberately shared with the backup and demo-data
  // services. It has no DOM side effects and preserves the legacy task shape.
  const normalizeTaskData = (input = {}, options = {}) => {
    const now = new Date().toISOString();
    const status = VALID_STATUSES.has(input.status) ? input.status : 'todo';
    const subtasks = normalizeSubtasks(input.subtasks);
    const progress = calculateProgress(
      { ...input, status },
      subtasks,
      Boolean(options.preferInputProgress)
    );

    return {
      title: String(input.title || '').trim(),
      description: String(input.description || '').trim(),
      deadline: String(input.deadline || '').trim(),
      priority: ['low', 'medium', 'high'].includes(input.priority) ?
        input.priority : 'medium',
      status,
      categoryId: String(input.categoryId || '').trim(),
      tags: normalizeTags(input.tags),
      pinned: Boolean(input.pinned),
      estimate: Number(input.estimate) || 0,
      progress,
      subtasks,
      notes: String(input.notes || '').trim(),
      createdAt: input.createdAt || now,
      updatedAt: now,
      completedAt: status === 'done' ? input.completedAt || now : null
    };
  };

  const emitChange = (type, id = '') => {
    window.dispatchEvent(new CustomEvent('taskflow:data-changed', {
      detail: { type, id }
    }));
  };

  const rollbackTaskMutation = previousTasks => {
    const rollbackResult = saveTasks(previousTasks);

    if (!rollbackResult.ok) {
      console.error('Không thể hoàn tác công việc sau lỗi ghi nhật ký.');
    }

    return storageError();
  };

  const createTask = input => {
    const validation = Validators.task(input);

    if (!validation.valid) {
      return { ok: false, errors: validation.errors };
    }

    const task = {
      id: Utils.uid('task'),
      ...normalizeTaskData(input)
    };
    const tasks = getTasks();
    const previousTasks = [...tasks];

    tasks.unshift(task);

    if (!saveTasks(tasks).ok) {
      return storageError();
    }

    if (!ActivityService.logActivity(
        'task_add',
        `Đã thêm công việc “${task.title}”`,
        task.id
      )) {
      return rollbackTaskMutation(previousTasks);
    }

    emitChange('task_add', task.id);
    return { ok: true, data: task };
  };

  const updateTask = (id, patch, options = {}) => {
    const tasks = getTasks();
    const previousTasks = [...tasks];
    const index = tasks.findIndex(task => task.id === id);

    if (index < 0) {
      return {
        ok: false,
        errors: { general: 'Không tìm thấy công việc.' }
      };
    }

    const previousTask = tasks[index];
    const mergedTask = { ...previousTask, ...patch, id };

    if (!options.skipValidation) {
      const validationData = {
        ...mergedTask,
        originalDeadline: Object.prototype.hasOwnProperty.call(patch, 'originalDeadline') ?
          patch.originalDeadline : previousTask.deadline
      };
      const validation = Validators.task(validationData);

      if (!validation.valid) {
        return { ok: false, errors: validation.errors };
      }
    }

    const normalizedTask = normalizeTaskData(mergedTask, {
      preferInputProgress: options.preferInputProgress
    });
    const updatedTask = {
      ...previousTask,
      ...normalizedTask,
      id,
      createdAt: previousTask.createdAt
    };

    tasks[index] = updatedTask;

    if (!saveTasks(tasks).ok) {
      return storageError();
    }

    const activity = options.activity || (!options.silent ? {
      type: 'task_update',
      text: `Đã cập nhật công việc “${updatedTask.title}”`,
      refId: id
    } : null);

    if (activity && !ActivityService.logActivity(
        activity.type,
        activity.text,
        activity.refId || id
      )) {
      return rollbackTaskMutation(previousTasks);
    }

    emitChange('task_update', id);
    return { ok: true, data: updatedTask };
  };

  const deleteTask = id => {
    const tasks = getTasks();
    const previousTasks = [...tasks];
    const task = tasks.find(item => item.id === id);

    if (!task) {
      return false;
    }

    const nextTasks = tasks.filter(item => item.id !== id);

    if (!saveTasks(nextTasks).ok) {
      return false;
    }

    if (!ActivityService.logActivity(
        'task_delete',
        `Đã xóa công việc “${task.title}”`,
        id
      )) {
      rollbackTaskMutation(previousTasks);
      return false;
    }

    emitChange('task_delete', id);
    return true;
  };

  const getProgressForStatus = (task, nextStatus) => {
    if (nextStatus === 'done') {
      return 100;
    }

    if (task.status === 'done' && nextStatus === 'todo') {
      return 0;
    }

    if (task.status === 'done' && nextStatus === 'progress') {
      return 25;
    }

    if (nextStatus === 'todo' && Number(task.progress) >= 100) {
      return 0;
    }

    if (nextStatus === 'progress' && Number(task.progress) >= 100) {
      return 25;
    }

    return Utils.clamp(task.progress, 0, 99);
  };

  const toggleTaskStatus = id => {
    const task = getTaskById(id);

    if (!task) {
      return null;
    }

    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    const result = updateTask(id, {
      status: nextStatus,
      progress: getProgressForStatus(task, nextStatus)
    }, {
      silent: true,
      preferInputProgress: true,
      activity: {
        type: nextStatus === 'done' ? 'task_done' : 'task_reopen',
        text: nextStatus === 'done' ?
          `Đã hoàn thành “${task.title}”` : `Đã mở lại “${task.title}”`,
        refId: id
      }
    });

    return result.ok ? result.data : null;
  };

  const setTaskStatus = (id, status) => {
    const task = getTaskById(id);

    if (!task || !VALID_STATUSES.has(status)) {
      return null;
    }

    const result = updateTask(id, {
      status,
      progress: getProgressForStatus(task, status)
    }, {
      silent: true,
      preferInputProgress: true,
      activity: {
        type: 'task_status',
        text: `Đã chuyển “${task.title}” sang ${StatisticsService.getStatusLabel(status)}`,
        refId: id
      }
    });

    return result.ok ? result.data : null;
  };

  const toggleTaskPin = id => {
    const task = getTaskById(id);

    if (!task) {
      return null;
    }

    const result = updateTask(id, { pinned: !task.pinned }, { silent: true });

    return result.ok ? result.data : null;
  };

  const duplicateTask = id => {
    const sourceTask = getTaskById(id);

    if (!sourceTask) {
      return null;
    }

    const clone = {
      ...sourceTask,
      id: undefined,
      title: `${sourceTask.title} (Bản sao)`,
      status: 'todo',
      progress: 0,
      pinned: false,
      completedAt: null,
      deadline: sourceTask.deadline < Utils.todayISO() ?
        Utils.todayISO() : sourceTask.deadline
    };
    const result = createTask(clone);

    return result.ok ? result.data : null;
  };

  const clearTasks = () => {
    const previousTasks = getTasks();
    const count = previousTasks.length;

    if (!saveTasks([]).ok) {
      return false;
    }

    if (!ActivityService.logActivity(
        'clear_all',
        `Đã xóa toàn bộ ${count} công việc`
      )) {
      rollbackTaskMutation(previousTasks);
      return false;
    }

    emitChange('clear_all');
    return true;
  };

  return {
    getTasks,
    saveTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    setTaskStatus,
    toggleTaskPin,
    duplicateTask,
    clearTasks,
    normalizeTaskData,
    repairStoredProgress,
    storageError
  };
})();
