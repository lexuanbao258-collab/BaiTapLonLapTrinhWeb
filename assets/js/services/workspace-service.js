'use strict';

const WorkspaceService = (() => {
  const isDemoAccount = () => {
    const currentUser = AuthService.getCurrentUser();

    return currentUser?.id === 'user_demo' ||
      currentUser?.email === 'demo@taskflow.local';
  };

  // Creates only missing scoped keys. It never migrates data between users.
  const ensureUserWorkspace = () => {
    let userId;

    try {
      userId = Storage.requireActiveUserId();
    } catch (error) {
      console.error(error.message);
      return false;
    }

    const workspaceResult = Storage.initializeUserData(userId);

    if (!workspaceResult.ok) {
      return false;
    }

    const categoryResult = CategoryService.ensureDefaults();

    return Boolean(categoryResult.ok && TaskService.repairStoredProgress());
  };

  const dateOffset = days => {
    const date = new Date();

    date.setDate(date.getDate() + days);
    return Utils.toISODate(date);
  };

  const sampleTasks = () => [{
    title: 'Hoàn thiện kế hoạch tuần này',
    description: 'Rà soát các ưu tiên, thời hạn và bước tiếp theo cho tuần mới.',
    deadline: dateOffset(2),
    priority: 'high',
    status: 'progress',
    categoryId: 'cat_project',
    tags: ['Kế hoạch', 'Ưu tiên'],
    pinned: true,
    estimate: 6,
    progress: 60,
    subtasks: [{
      title: 'Rà soát lịch tuần',
      done: true
    }, {
      title: 'Chốt các ưu tiên',
      done: true
    }, {
      title: 'Sắp xếp thời gian tập trung',
      done: false
    }],
    notes: 'Dành thời gian cho những việc tạo nhiều giá trị nhất.'
  }, {
    title: 'Dành 30 phút học kỹ năng mới',
    description: 'Chọn một chủ đề đang quan tâm và ghi lại những điểm quan trọng.',
    deadline: dateOffset(1),
    priority: 'high',
    status: 'todo',
    categoryId: 'cat_study',
    tags: ['Phát triển bản thân'],
    pinned: true,
    estimate: 3,
    subtasks: [{
      title: 'Chọn chủ đề',
      done: true
    }, {
      title: 'Ghi chú điều hữu ích',
      done: false
    }, {
      title: 'Lên lịch buổi tiếp theo',
      done: false
    }]
  }, {
    title: 'Luyện piano 30 phút',
    description: 'Luyện gam C trưởng và bài nhạc đang học với metronome chậm.',
    deadline: dateOffset(0),
    priority: 'medium',
    status: 'todo',
    categoryId: 'cat_personal',
    tags: ['Piano'],
    estimate: 0.5
  }, {
    title: 'Tập gym buổi thân trên',
    description: 'Khởi động kỹ, tập ngực, vai, tay sau và giãn cơ sau buổi tập.',
    deadline: dateOffset(3),
    priority: 'medium',
    status: 'todo',
    categoryId: 'cat_health',
    tags: ['Sức khỏe'],
    estimate: 1.5
  }, {
    title: 'Hoàn thành các việc ưu tiên',
    description: 'Xử lý các việc quan trọng và xác nhận từng mục đã hoàn tất.',
    deadline: dateOffset(-1),
    priority: 'high',
    status: 'done',
    categoryId: 'cat_project',
    tags: ['Ưu tiên'],
    estimate: 4,
    completedAt: new Date().toISOString()
  }, {
    title: 'Học 20 từ vựng tiếng Trung',
    description: 'Học phát âm, nghĩa, cách viết và đặt câu với từng từ mới.',
    deadline: dateOffset(4),
    priority: 'low',
    status: 'progress',
    categoryId: 'cat_study',
    tags: ['Tiếng Trung'],
    estimate: 1,
    progress: 35
  }, {
    title: 'Sắp xếp tài liệu học tập',
    description: 'Phân loại tài liệu cần giữ và dọn các tệp không còn sử dụng.',
    deadline: dateOffset(7),
    priority: 'low',
    status: 'todo',
    categoryId: 'cat_personal',
    tags: ['Dọn dẹp'],
    estimate: 1
  }, {
    title: 'Chuẩn bị kế hoạch cho tuần tới',
    description: 'Xác định mục tiêu, thời hạn và các bước cần thực hiện.',
    deadline: dateOffset(5),
    priority: 'medium',
    status: 'todo',
    categoryId: 'cat_project',
    tags: ['Kế hoạch', 'Chuẩn bị'],
    estimate: 2
  }];

  const seedDemoData = () => {
    if (!isDemoAccount() || !ensureUserWorkspace()) {
      return false;
    }

    const seededResult = Storage.inspect(CONFIG.STORAGE.SEEDED);

    if (!seededResult.ok) {
      return false;
    }

    if (seededResult.found && typeof seededResult.value !== 'boolean') {
      console.error('Cờ dữ liệu mẫu trong LocalStorage không hợp lệ.');
      return false;
    }

    if (seededResult.value === true) {
      return true;
    }

    const currentTasks = TaskService.getTasks();
    const currentActivities = ActivityService.getActivityList();
    const newTasks = sampleTasks()
      .map(input => ({
        id: Utils.uid('task'),
        ...TaskService.normalizeTaskData(input)
      }))
      .reverse();

    if (!TaskService.saveTasks([...newTasks, ...currentTasks]).ok) {
      return false;
    }

    const seedFlagResult = Storage.write(CONFIG.STORAGE.SEEDED, true);

    if (!seedFlagResult.ok) {
      TaskService.saveTasks(currentTasks);
      return false;
    }

    const seededActivities = newTasks.map(task => ActivityService.createActivity(
      'task_add',
      `Đã thêm công việc “${task.title}”`,
      task.id
    ));
    const activityResult = ActivityService.saveActivities([
      ...seededActivities,
      ...currentActivities
    ]);

    if (!activityResult.ok) {
      const taskRollback = TaskService.saveTasks(currentTasks);
      const seedRollback = seededResult.found ?
        Storage.write(CONFIG.STORAGE.SEEDED, seededResult.value) :
        Storage.remove(CONFIG.STORAGE.SEEDED);

      if (!taskRollback.ok || !seedRollback.ok) {
        console.error('Không thể hoàn tác dữ liệu mẫu sau lỗi ghi nhật ký.');
      }

      return false;
    }

    window.dispatchEvent(new CustomEvent('taskflow:data-changed', {
      detail: { type: 'seed' }
    }));

    return true;
  };

  const captureEntries = keys => keys.map(key => {
    const result = Storage.inspect(key);

    return {
      key,
      found: Boolean(result.ok && result.found),
      value: result.value
    };
  });

  const restoreEntries = entries => {
    return entries.every(entry => {
      const result = entry.found ?
        Storage.write(entry.key, entry.value) :
        Storage.remove(entry.key);

      return Boolean(result?.ok);
    });
  };

  const resetDemoData = () => {
    if (!isDemoAccount()) {
      return {
        ok: false,
        message: 'Tính năng này chỉ dành cho không gian trải nghiệm.'
      };
    }

    const affectedKeys = [
      CONFIG.STORAGE.TASKS,
      CONFIG.STORAGE.CATEGORIES,
      CONFIG.STORAGE.SEEDED,
      CONFIG.STORAGE.ACTIVITIES
    ];
    const snapshot = captureEntries(affectedKeys);

    for (const key of [
      CONFIG.STORAGE.TASKS,
      CONFIG.STORAGE.CATEGORIES,
      CONFIG.STORAGE.SEEDED
    ]) {
      const removeResult = Storage.remove(key);

      if (!removeResult.ok) {
        restoreEntries(snapshot);
        return { ok: false, message: 'Không thể làm mới không gian trải nghiệm.' };
      }
    }

    if (!seedDemoData()) {
      restoreEntries(snapshot);
      return { ok: false, message: 'Không thể khôi phục không gian trải nghiệm.' };
    }

    return { ok: true };
  };

  return {
    isDemoAccount,
    ensureUserWorkspace,
    seedDemoData,
    resetDemoData
  };
})();
