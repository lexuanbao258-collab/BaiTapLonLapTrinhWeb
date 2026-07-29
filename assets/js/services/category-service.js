'use strict';

const CategoryService = (() => {
  const STORAGE_ERROR =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';

  const defaults = () => {
    const createdAt = new Date().toISOString();

    return CONFIG.DEFAULT_CATEGORIES.map(category => ({
      ...category,
      createdAt
    }));
  };

  const getAll = () => {
    const categories = Storage.read(CONFIG.STORAGE.CATEGORIES, []);

    return Array.isArray(categories) ? categories : [];
  };

  const saveAll = categories => {
    return Storage.write(CONFIG.STORAGE.CATEGORIES, categories);
  };

  const ensureDefaults = () => {
    const storedCategories = Storage.inspect(CONFIG.STORAGE.CATEGORIES);

    if (!storedCategories.ok) {
      return storageError();
    }

    if (storedCategories.found && !Array.isArray(storedCategories.value)) {
      console.error('Dữ liệu danh mục trong LocalStorage không hợp lệ.');
      return storageError();
    }

    if (storedCategories.found) {
      return {
        ok: true
      };
    }

    return saveAll(defaults());
  };

  const getById = id => {
    return getAll().find(item => item.id === id) || null;
  };

  const storageError = () => {
    return {
      ok: false,
      errors: {
        general: STORAGE_ERROR
      }
    };
  };

  const hasDuplicateName = (categories, name, ignoredId = '') => {
    const normalizedName = Utils.normalize(name);

    return categories.some(category => {
      return category.id !== ignoredId &&
        Utils.normalize(category.name) === normalizedName;
    });
  };

  const emitChange = () => {
    window.dispatchEvent(new CustomEvent('taskflow:data-changed', {
      detail: {
        type: 'category'
      }
    }));
  };

  const add = input => {
    const check = Validators.category(input);

    if (!check.valid) {
      return {
        ok: false,
        errors: check.errors
      };
    }

    const categories = getAll();
    const previousCategories = [...categories];

    if (hasDuplicateName(categories, input.name)) {
      return {
        ok: false,
        errors: {
          name: 'Tên danh mục đã tồn tại.'
        }
      };
    }

    const category = {
      id: Utils.uid('cat'),
      name: input.name.trim(),
      color: input.color || CONFIG.DEFAULT_CATEGORY_COLOR,
      icon: input.icon || '📁',
      createdAt: new Date().toISOString()
    };

    categories.push(category);

    const saveResult = saveAll(categories);

    if (!saveResult.ok) {
      return storageError();
    }

    const activityLogged = ActivityService.logActivity(
      'category_add',
      `Đã tạo danh mục “${category.name}”`,
      category.id
    );

    if (activityLogged === false) {
      const rollbackResult = saveAll(previousCategories);

      if (!rollbackResult.ok) {
        console.error('Không thể hoàn tác danh mục sau lỗi ghi nhật ký.');
      }

      return storageError();
    }

    emitChange();

    return {
      ok: true,
      data: category
    };
  };

  const update = (id, input) => {
    const check = Validators.category(input);

    if (!check.valid) {
      return {
        ok: false,
        errors: check.errors
      };
    }

    const categories = getAll();
    const previousCategories = [...categories];
    const index = categories.findIndex(item => item.id === id);

    if (index < 0) {
      return {
        ok: false,
        errors: {
          name: 'Không tìm thấy danh mục.'
        }
      };
    }

    if (hasDuplicateName(categories, input.name, id)) {
      return {
        ok: false,
        errors: {
          name: 'Tên danh mục đã tồn tại.'
        }
      };
    }

    categories[index] = {
      ...categories[index],
      name: input.name.trim(),
      color: input.color || CONFIG.DEFAULT_CATEGORY_COLOR,
      icon: input.icon || '📁',
      updatedAt: new Date().toISOString()
    };

    const saveResult = saveAll(categories);

    if (!saveResult.ok) {
      return storageError();
    }

    const activityLogged = ActivityService.logActivity(
      'category_update',
      `Đã cập nhật danh mục “${categories[index].name}”`,
      id
    );

    if (activityLogged === false) {
      const rollbackResult = saveAll(previousCategories);

      if (!rollbackResult.ok) {
        console.error('Không thể hoàn tác danh mục sau lỗi ghi nhật ký.');
      }

      return storageError();
    }

    emitChange();

    return {
      ok: true,
      data: categories[index]
    };
  };

  const remove = (id, moveTasksTo = '') => {
    const categories = getAll();
    const category = categories.find(item => item.id === id);

    if (!category) {
      return false;
    }

    const destinationExists = categories.some(item => {
      return item.id === moveTasksTo && item.id !== id;
    });
    const destinationId = destinationExists ? moveTasksTo : '';
    const currentTasks = TaskService.getTasks();
    const hasRelatedTasks = currentTasks.some(task => task.categoryId === id);
    const nextTasks = currentTasks.map(task => {
      if (task.categoryId !== id) {
        return task;
      }

      return {
        ...task,
        categoryId: destinationId,
        updatedAt: new Date().toISOString()
      };
    });

    if (hasRelatedTasks) {
      const taskSaveResult = TaskService.saveTasks(nextTasks);

      if (!taskSaveResult.ok) {
        return false;
      }
    }

    const nextCategories = categories.filter(item => item.id !== id);
    const categorySaveResult = saveAll(nextCategories);

    if (!categorySaveResult.ok) {
      if (hasRelatedTasks) {
        const rollbackResult = TaskService.saveTasks(currentTasks);

        if (!rollbackResult.ok) {
          console.error('Không thể hoàn tác danh mục của công việc.');
        }
      }

      return false;
    }

    const activityLogged = ActivityService.logActivity(
      'category_delete',
      `Đã xóa danh mục “${category.name}”`,
      id
    );

    if (!activityLogged) {
      const categoryRollback = saveAll(categories);
      const taskRollback = hasRelatedTasks ?
        TaskService.saveTasks(currentTasks) : {
          ok: true
        };

      if (!categoryRollback.ok || !taskRollback.ok) {
        console.error('Không thể hoàn tác xóa danh mục sau lỗi ghi nhật ký.');
      }

      return false;
    }

    emitChange();

    return true;
  };

  return {
    defaults,
    getAll,
    saveAll,
    ensureDefaults,
    getById,
    add,
    update,
    remove
  };
})();

