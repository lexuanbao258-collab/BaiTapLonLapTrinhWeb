'use strict';

(() => {
  if (App.page !== 'tasks') {
    return;
  }

  const params = new URLSearchParams(location.search);
  const savedViewMode = SettingsService.getSettings().viewMode;
  const SORT_OPTIONS = new Set([
    'deadlineAsc',
    'deadlineDesc',
    'priority',
    'newest',
    'oldest',
    'title'
  ]);
  const requestedSort = params.get('sort');
  const state = {
    query: params.get('q') || '',
    status: 'all',
    priority: 'all',
    category: params.get('category') || 'all',
    date: params.get('date') || 'all',
    sort: SORT_OPTIONS.has(requestedSort) ? requestedSort : 'deadlineAsc',
    pinned: false,
    view: ['list', 'grid'].includes(savedViewMode) ? savedViewMode : 'list',
    page: 1
  };

  const elements = {
    addTask: document.querySelector('#addTask'),
    importTasks: document.querySelector('#importTasks'),
    exportTasks: document.querySelector('#exportTasks'),
    quickChips: document.querySelector('#quickChips'),
    taskSearch: document.querySelector('#taskSearch'),
    statusFilter: document.querySelector('#statusFilter'),
    priorityFilter: document.querySelector('#priorityFilter'),
    categoryFilter: document.querySelector('#categoryFilter'),
    sortFilter: document.querySelector('#sortFilter'),
    viewSwitcher: document.querySelector('.segmented'),
    resetFilters: document.querySelector('#resetFilters'),
    resetEmptyState: document.querySelector('#resetEmptyState'),
    moreData: document.querySelector('#moreData'),
    taskDataMenu: document.querySelector('#taskDataMenu'),
    visibleTaskCount: document.querySelector('#visibleTaskCount'),
    filteredTaskCount: document.querySelector('#filteredTaskCount'),
    allTaskCount: document.querySelector('#allTaskCount'),
    currentTaskPage: document.querySelector('#currentTaskPage'),
    totalTaskPages: document.querySelector('#totalTaskPages'),
    tasksContainer: document.querySelector('#tasksContainer'),
    taskEmptyState: document.querySelector('#taskEmptyState'),
    taskPagination: document.querySelector('#taskPagination'),
    taskImportModal: document.querySelector('#taskImportModal'),
    taskImportForm: document.querySelector('#taskImportForm'),
    taskImportFile: document.querySelector('#taskImportFile'),
    taskImportFileError: document.querySelector('#taskImportFileError'),
    closeTaskImportModal: document.querySelector('#closeTaskImportModal'),
    cancelTaskImport: document.querySelector('#cancelTaskImport'),
    confirmTaskImport: document.querySelector('#confirmTaskImport'),
    confirmTaskImportLabel: document.querySelector('#confirmTaskImportLabel'),
    importModeMerge: document.querySelector('#importModeMerge'),
    importModeOverwrite: document.querySelector('#importModeOverwrite'),
    importModeNote: document.querySelector('#importModeNote'),
    taskImportPreview: document.querySelector('#taskImportPreview'),
    csvValidCount: document.querySelector('[data-csv-stat="valid"]'),
    csvInvalidCount: document.querySelector('[data-csv-stat="invalid"]'),
    csvCategoryCount: document.querySelector('[data-csv-stat="categories"]'),
    csvWarningCount: document.querySelector('[data-csv-stat="warnings"]')
  };

  let taskImportTrigger = null;
  let pendingCSVRows = null;
  let pendingCSVPreview = null;
  let csvPreviewRequest = 0;

  const requiredElements = Object.values(elements);

  if (requiredElements.some(element => !element)) {
    console.error('Trang công việc chưa có đầy đủ cấu trúc HTML cần thiết.');
    return;
  }

  const getFiltered = () => {
    const query = Utils.normalize(state.query);
    let tasks = TaskService.getTasks().filter(task => {
      const searchableText = [
        task.title,
        task.description,
        (task.tags || []).join(' ')
      ].join(' ');
      const matchesQuery = !query ||
        Utils.normalize(searchableText).includes(query);
      const matchesStatus = state.status === 'all' ||
        task.status === state.status ||
        (state.status === 'pending' && task.status !== 'done');
      const matchesPriority = state.priority === 'all' ||
        task.priority === state.priority;
      const matchesCategory = state.category === 'all' ||
        task.categoryId === state.category;
      const matchesPinned = !state.pinned || task.pinned;
      let matchesDate = true;

      if (state.date === 'today') {
        matchesDate = Utils.isToday(task.deadline);
      }

      if (state.date === 'week') {
        matchesDate = Utils.isThisWeek(task.deadline);
      }

      if (state.date === 'overdue') {
        matchesDate = Utils.isOverdue(task);
      }

      if (state.date === 'upcoming') {
        matchesDate = task.status !== 'done' &&
          task.deadline >= Utils.todayISO();
      }

      return matchesQuery &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesPinned &&
        matchesDate;
    });
    const priorityWeight = Object.fromEntries(
      CONFIG.PRIORITIES.map(priority => [
        priority.value,
        priority.weight
      ])
    );

    tasks.sort((firstTask, secondTask) => {
      if (firstTask.pinned !== secondTask.pinned) {
        return firstTask.pinned ? -1 : 1;
      }

      if (state.sort === 'deadlineAsc') {
        return (firstTask.deadline || '9999')
          .localeCompare(secondTask.deadline || '9999');
      }

      if (state.sort === 'deadlineDesc') {
        return (secondTask.deadline || '')
          .localeCompare(firstTask.deadline || '');
      }

      if (state.sort === 'priority') {
        return priorityWeight[secondTask.priority] -
          priorityWeight[firstTask.priority];
      }

      if (state.sort === 'newest') {
        return new Date(secondTask.createdAt) -
          new Date(firstTask.createdAt);
      }

      if (state.sort === 'oldest') {
        return new Date(firstTask.createdAt) -
          new Date(secondTask.createdAt);
      }

      if (state.sort === 'title') {
        return String(firstTask.title).localeCompare(
          String(secondTask.title),
          'vi'
        );
      }

      return 0;
    });

    return tasks;
  };

  const closeDataMenu = () => {
    elements.taskDataMenu.hidden = true;
    elements.moreData.setAttribute('aria-expanded', 'false');
  };

  const renderCategoryOptions = categories => {
    elements.categoryFilter
      .querySelectorAll('option:not([value="all"])')
      .forEach(option => option.remove());

    categories.forEach(category => {
      const option = document.createElement('option');

      option.value = String(category.id || '');
      option.textContent = [
        category.icon,
        category.name
      ].filter(Boolean).join(' ');
      elements.categoryFilter.appendChild(option);
    });
  };

  const syncControls = () => {
    if (elements.taskSearch.value !== state.query) {
      elements.taskSearch.value = state.query;
    }

    elements.statusFilter.value = state.status;
    elements.priorityFilter.value = state.priority;
    elements.categoryFilter.value = state.category;
    elements.sortFilter.value = state.sort;

    elements.quickChips.querySelectorAll('[data-date]').forEach(button => {
      const active = button.dataset.date === state.date;

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const pinnedButton = elements.quickChips.querySelector('[data-pinned]');

    pinnedButton.classList.toggle('active', state.pinned);
    pinnedButton.setAttribute('aria-pressed', String(state.pinned));

    elements.viewSwitcher.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === state.view;

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const paginationMarkup = totalPages => {
    const pageNumbers = Array.from(
      {
        length: totalPages
      },
      (_, index) => index + 1
    ).filter(page => {
      return totalPages <= 7 ||
        page === 1 ||
        page === totalPages ||
        Math.abs(page - state.page) <= 1;
    });

    const pageButtons = pageNumbers.reduce((html, page, index, pages) => {
      const needsSeparator = index && page - pages[index - 1] > 1;
      const separator = needsSeparator ? '<span>…</span>' : '';
      const activeClass = page === state.page ? ' class="active"' : '';
      const currentPage = page === state.page ? ' aria-current="page"' : '';

      return html +
        separator +
        '<button type="button" data-page="' +
        page +
        '"' +
        activeClass +
        currentPage +
        '>' +
        page +
        '</button>';
    }, '');

    return [
      '<button type="button" data-page="prev" aria-label="Trang trước"',
      state.page === 1 ? ' disabled' : '',
      '>',
      Icons.render('chevronLeft', 16),
      '</button>',
      pageButtons,
      '<button type="button" data-page="next" aria-label="Trang sau"',
      state.page === totalPages ? ' disabled' : '',
      '>',
      Icons.render('chevronRight', 16),
      '</button>'
    ].join('');
  };

  const render = () => {
    closeDataMenu();

    const categories = CategoryService.getAll();
    const tasks = getFiltered();
    const totalPages = Math.max(
      1,
      Math.ceil(tasks.length / CONFIG.PAGE_SIZE)
    );

    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * CONFIG.PAGE_SIZE;
    const visibleTasks = tasks.slice(start, start + CONFIG.PAGE_SIZE);
    const totalTasks = TaskService.getTasks().length;

    renderCategoryOptions(categories);
    syncControls();

    elements.visibleTaskCount.textContent = visibleTasks.length;
    elements.filteredTaskCount.textContent = tasks.length;
    elements.allTaskCount.textContent = totalTasks;
    elements.currentTaskPage.textContent = state.page;
    elements.totalTaskPages.textContent = totalPages;

    elements.tasksContainer.className = state.view === 'grid' ?
      'tasks-grid' :
      'tasks-list';
    elements.tasksContainer.innerHTML = visibleTasks.map(task => {
      return state.view === 'grid' ?
        UI.taskCard(task) :
        UI.taskRow(task);
    }).join('');

    const hasVisibleTasks = visibleTasks.length > 0;

    elements.tasksContainer.hidden = !hasVisibleTasks;
    elements.taskEmptyState.hidden = hasVisibleTasks;
    elements.taskPagination.hidden = !hasVisibleTasks;

    if (hasVisibleTasks) {
      elements.taskPagination.innerHTML = paginationMarkup(totalPages);
    } else {
      elements.taskPagination.replaceChildren();
    }
  };

  const reset = () => {
    Object.assign(state, {
      query: '',
      status: 'all',
      priority: 'all',
      category: 'all',
      date: 'all',
      sort: 'deadlineAsc',
      pinned: false,
      page: 1
    });

    history.replaceState(null, '', 'tasks.html');
    render();
  };

  const resetCSVImportState = () => {
    pendingCSVRows = null;
    pendingCSVPreview = null;
    csvPreviewRequest += 1;
    elements.taskImportForm.reset();
    elements.taskImportFileError.textContent = '';
    elements.taskImportFile.classList.remove('invalid');
    elements.confirmTaskImport.disabled = true;
    elements.taskImportPreview.hidden = true;
    elements.csvValidCount.textContent = '0';
    elements.csvInvalidCount.textContent = '0';
    elements.csvCategoryCount.textContent = '0';
    elements.csvWarningCount.textContent = '0';
  };

  const renderCSVPreview = preview => {
    pendingCSVPreview = preview;
    elements.csvValidCount.textContent = String(preview.valid);
    elements.csvInvalidCount.textContent = String(preview.invalid);
    elements.csvCategoryCount.textContent = String(
      preview.categoriesToCreate.length
    );
    elements.csvWarningCount.textContent = String(preview.warningCount);
    elements.taskImportPreview.hidden = false;
    elements.confirmTaskImport.disabled = preview.valid === 0;
  };

  const closeTaskImportModal = () => {
    const modal = elements.taskImportModal;

    if (modal.hidden) {
      return;
    }

    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    window.setTimeout(() => {
      modal.hidden = true;
      resetCSVImportState();

      if (taskImportTrigger?.isConnected) {
        taskImportTrigger.focus({
          preventScroll: true
        });
      }

      taskImportTrigger = null;
    }, 180);
  };

  const openTaskImportModal = (trigger, openFilePicker = false) => {
    taskImportTrigger = trigger || document.activeElement;
    resetCSVImportState();
    elements.taskImportModal.hidden = false;
    elements.taskImportModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (openFilePicker) {
      elements.taskImportFile.click();
    }

    requestAnimationFrame(() => {
      elements.taskImportModal.classList.add('visible');

      if (!openFilePicker) {
        elements.taskImportFile.focus();
      }
    });
  };

  const showImportError = message => {
    elements.taskImportFileError.textContent = message;
    elements.taskImportFile.classList.add('invalid');
    elements.taskImportFile.focus();
  };

  const getImportMode = () => {
    return elements.importModeOverwrite?.checked ? 'overwrite' : 'merge';
  };

  const previewCSVFile = async () => {
    const file = elements.taskImportFile.files?.[0];

    pendingCSVRows = null;
    pendingCSVPreview = null;
    elements.taskImportFileError.textContent = '';
    elements.taskImportFile.classList.remove('invalid');
    elements.taskImportPreview.hidden = true;
    elements.confirmTaskImport.disabled = true;

    if (!file) {
      return;
    }

    const requestId = ++csvPreviewRequest;

    try {
      const parsed = await CSVService.parseCSVFile(file);

      if (requestId !== csvPreviewRequest) {
        return;
      }

      const preview = CSVService.previewImport(parsed.rows);

      if (!preview.valid) {
        showImportError('Tệp danh sách chưa có công việc hợp lệ để nhập.');
        return;
      }

      pendingCSVRows = parsed.rows;
      renderCSVPreview(preview);
    } catch (error) {
      if (requestId === csvPreviewRequest) {
        showImportError(error?.message || 'Không thể đọc tệp danh sách.');
      }
    }
  };

  const importTasksFromFile = async event => {
    event.preventDefault();

    if (!pendingCSVRows || !pendingCSVPreview) {
      await previewCSVFile();
    }

    if (!pendingCSVRows || !pendingCSVPreview) {
      return;
    }

    const mode = getImportMode();

    elements.confirmTaskImport.disabled = true;

    const result = CSVService.importTasks(pendingCSVRows, mode);

    if (!UI.mutationSucceeded(result)) {
      showImportError(result?.message || 'Không thể nhập danh sách công việc.');
      elements.confirmTaskImport.disabled = false;
      return;
    }

    closeTaskImportModal();

    if (!result.count) {
      UI.toast('Không có công việc mới để nhập.', 'info');
      return;
    }

    const details = [
      `Đã ${mode === 'overwrite' ? 'thay thế bằng' : 'nhập'} ${result.count} công việc`
    ];

    if (result.categoriesCreated) {
      details.push(`thêm ${result.categoriesCreated} danh mục`);
    }

    if (result.skipped) {
      details.push(`bỏ qua ${result.skipped} mục`);
    }

    UI.toast(`${details.join(', ')}.`);
  };

  const openDataMenu = () => {
    const rect = elements.moreData.getBoundingClientRect();

    elements.taskDataMenu.hidden = false;
    elements.moreData.setAttribute('aria-expanded', 'true');
    elements.taskDataMenu.style.left =
      Math.max(12, rect.right - 210) + 'px';
    elements.taskDataMenu.style.top =
      Math.min(
        window.innerHeight - elements.taskDataMenu.offsetHeight - 12,
        rect.bottom + 8
      ) + 'px';
  };

  const toggleDataMenu = () => {
    if (elements.taskDataMenu.hidden) {
      openDataMenu();
      return;
    }

    closeDataMenu();
  };

  const handleDataAction = async event => {
    const actionButton = event.target.closest('[data-data-action]');

    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.dataAction;

    closeDataMenu();

    if (action === 'manage') {
      location.href = 'about.html?tab=data';
      return;
    }

    if (action === 'backup') {
      const result = BackupService.createBackup();

      if (!UI.mutationSucceeded(result)) {
        UI.toast(UI.mutationErrorMessage(result), 'error');
        return;
      }

      UI.toast('Đã tạo bản sao lưu.');
      return;
    }

    if (action !== 'clear') {
      return;
    }

    elements.moreData.focus();

    const accepted = await UI.confirm({
      title: 'Xóa toàn bộ công việc?',
      message: 'Tất cả công việc hiện tại sẽ bị xóa. Bạn nên tạo bản sao lưu trước khi tiếp tục.',
      confirmText: 'Xóa tất cả'
    });

    if (!accepted) {
      return;
    }

    const result = TaskService.clearTasks();

    if (!UI.mutationSucceeded(result)) {
      UI.toast(UI.mutationErrorMessage(result), 'error');
      return;
    }

    UI.toast('Đã xóa toàn bộ công việc.');
  };

  const bindFilters = () => {
    elements.taskSearch.addEventListener('input', Utils.debounce(() => {
      state.query = elements.taskSearch.value;
      state.page = 1;
      render();
    }, 220));

    [
      [elements.statusFilter, 'status'],
      [elements.priorityFilter, 'priority'],
      [elements.categoryFilter, 'category'],
      [elements.sortFilter, 'sort']
    ].forEach(([select, key]) => {
      select.addEventListener('change', event => {
        state[key] = event.target.value;
        state.page = 1;
        render();
      });
    });

    elements.quickChips.addEventListener('click', event => {
      const dateButton = event.target.closest('[data-date]');

      if (dateButton) {
        state.date = dateButton.dataset.date;
        state.page = 1;
        render();
        return;
      }

      if (event.target.closest('[data-pinned]')) {
        state.pinned = !state.pinned;
        state.page = 1;
        render();
      }
    });
  };

  const bindPagination = () => {
    elements.taskPagination.addEventListener('click', event => {
      const target = event.target.closest('[data-page]');

      if (!target || target.disabled) {
        return;
      }

      const totalPages = Number(elements.totalTaskPages.textContent) || 1;
      const value = target.dataset.page;

      if (value === 'prev') {
        state.page -= 1;
      } else if (value === 'next') {
        state.page += 1;
      } else {
        state.page = Number(value);
      }

      state.page = Utils.clamp(state.page, 1, totalPages);
      render();

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  };

  const bind = () => {
    elements.addTask.addEventListener('click', () => {
      UI.taskForm();
    });

    elements.importTasks.addEventListener('click', event => {
      openTaskImportModal(event.currentTarget, true);
    });

    elements.exportTasks.addEventListener('click', () => {
      try {
        const result = CSVService.downloadTasksCSV();

        UI.toast(`Đã tải ${result.count} công việc trong danh sách.`);
      } catch (error) {
        UI.toast(error?.message || 'Không thể tải danh sách.', 'error');
      }
    });

    bindFilters();
    bindPagination();

    elements.viewSwitcher.addEventListener('click', event => {
      const viewButton = event.target.closest('[data-view]');

      if (!viewButton || viewButton.dataset.view === state.view) {
        return;
      }

      const nextView = viewButton.dataset.view;
      const result = SettingsService.saveSettings({
        viewMode: nextView
      });

      if (!UI.mutationSucceeded(result)) {
        UI.toast(UI.mutationErrorMessage(result), 'error');
        return;
      }

      state.view = nextView;
      render();
    });

    elements.resetFilters.addEventListener('click', reset);
    elements.resetEmptyState.addEventListener('click', reset);
    elements.moreData.addEventListener('click', toggleDataMenu);
    elements.taskDataMenu.addEventListener('click', handleDataAction);
    elements.taskImportFile.addEventListener('change', previewCSVFile);
    elements.taskImportForm.addEventListener('submit', importTasksFromFile);
    elements.closeTaskImportModal.addEventListener(
      'click',
      closeTaskImportModal
    );
    elements.cancelTaskImport.addEventListener('click', closeTaskImportModal);
    elements.taskImportModal.addEventListener('mousedown', event => {
      if (event.target === elements.taskImportModal) {
        closeTaskImportModal();
      }
    });

    document.addEventListener('click', event => {
      if (
        !elements.taskDataMenu.hidden &&
        !elements.taskDataMenu.contains(event.target) &&
        !elements.moreData.contains(event.target)
      ) {
        closeDataMenu();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDataMenu();
        closeTaskImportModal();
      }
    });

    // Cập nhật giao diện khi đổi chế độ import
    const updateImportModeUI = () => {
      const isOverwrite = elements.importModeOverwrite?.checked;

      if (elements.confirmTaskImportLabel) {
        elements.confirmTaskImportLabel.textContent = isOverwrite ?
          'Thay thế công việc' : 'Nhập công việc';
      }

      if (elements.importModeNote) {
        elements.importModeNote.innerHTML = isOverwrite ?
          '<i data-icon="warning" data-icon-size="18"></i><span>Chế độ <strong>Thay thế</strong>: danh sách công việc hiện tại sẽ được thay bằng file. Bản sao lưu được tạo trước khi thực hiện.</span>' :
          '<i data-icon="info" data-icon-size="18"></i><span>Chọn <strong>Thêm</strong> để giữ các công việc hiện có.</span>';
        App.renderIcons(elements.importModeNote);
      }
    };

    elements.importModeMerge?.addEventListener('change', updateImportModeUI);
    elements.importModeOverwrite?.addEventListener('change', updateImportModeUI);

    UI.bindTaskActions(elements.tasksContainer);
  };

  bind();
  window.addEventListener('taskflow:data-changed', render);
  render();
})();
