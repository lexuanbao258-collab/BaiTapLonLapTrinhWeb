'use strict';

const SettingsPage = (() => {
  const ALLOWED_TABS = ['appearance', 'data', 'info'];
  const query = new URLSearchParams(window.location.search);
  let activeTab = ALLOWED_TABS.includes(query.get('tab')) ? query.get('tab') : 'appearance';
  let importBusy = false;
  let autoImportPending = activeTab === 'data' && query.get('import') === '1';

  const setModalText = (modal, name, value) => {
    const element = modal.querySelector(`[data-import-stat="${name}"]`);

    if (element) {
      element.textContent = String(value);
    }
  };

  const applyTabState = () => {
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === activeTab;

      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    document.querySelectorAll('[data-section]').forEach(section => {
      const active = section.dataset.section === activeTab;

      section.classList.toggle('active', active);
      section.hidden = !active;
    });
  };

  const renderAppearanceState = () => {
    const settings = SettingsService.getSettings();

    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const active = button.dataset.themeChoice === settings.theme;

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('[data-accent]').forEach(button => {
      const color = String(button.dataset.accent || '');
      const active = color.toLowerCase() === String(settings.accent || '').toLowerCase();

      if (/^#[0-9a-f]{6}$/i.test(color)) {
        button.style.setProperty('--button-color', color);
      }

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const compactToggle = document.querySelector('#compactToggle');

    if (compactToggle) {
      compactToggle.checked = Boolean(settings.compact);
    }
  };

  const renderBackups = () => {
    const backups = BackupService.getBackups();
    const list = document.querySelector('#backupList');
    const emptyState = document.querySelector('#backupEmptyState');

    if (!list || !emptyState) {
      return;
    }

    list.innerHTML = backups.map(backup => {
      const taskCount = Array.isArray(backup?.data?.tasks) ? backup.data.tasks.length : 0;
      const date = Utils.formatDateTime(backup?.createdAt) || 'Không rõ thời gian';

      return `
        <div class="backup-item" data-backup-id="${Utils.escapeHTML(String(backup?.id || ''))}">
          <div>
            <strong>${Utils.escapeHTML(backup?.name || 'Bản sao lưu')}</strong>
            <small>${Utils.escapeHTML(date)} · ${taskCount} công việc</small>
          </div>
          <div class="backup-actions">
            <button class="icon-btn" type="button" data-backup-action="restore"
              title="Khôi phục" aria-label="Khôi phục bản sao lưu">
              ${Icons.render('refresh', 17)}
            </button>
            <button class="icon-btn" type="button" data-backup-action="delete"
              title="Xóa" aria-label="Xóa bản sao lưu">
              ${Icons.render('trash', 17)}
            </button>
          </div>
        </div>
      `;
    }).join('');
    emptyState.hidden = backups.length > 0;
  };

  const refresh = () => {
    applyTabState();
    renderAppearanceState();
    renderBackups();
  };

  const showStorageError = () => {
    Toast.show('Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.', 'error', 4800);
  };

  const bindTabs = () => {
    const tabButtons = [...document.querySelectorAll('[data-tab]')];

    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        activeTab = button.dataset.tab;
        refresh();
      });

      button.addEventListener('keydown', event => {
        const lastIndex = tabButtons.length - 1;
        let nextIndex = index;

        if (event.key === 'ArrowRight') {
          nextIndex = index === lastIndex ? 0 : index + 1;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = index === 0 ? lastIndex : index - 1;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = lastIndex;
        } else {
          return;
        }

        event.preventDefault();
        activeTab = tabButtons[nextIndex].dataset.tab;
        refresh();
        tabButtons[nextIndex].focus();
      });
    });
  };

  const applySetting = (patch, successMessage) => {
    const result = SettingsService.saveSettings(patch);

    if (!result) {
      showStorageError();
      return;
    }

    App.applySettings();
    refresh();
    Toast.show(successMessage, 'info');
  };

  const bindAppearanceSettings = () => {
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        applySetting({ theme: button.dataset.themeChoice }, 'Đã cập nhật chế độ hiển thị.');
      });
    });

    document.querySelectorAll('[data-accent]').forEach(button => {
      button.addEventListener('click', () => {
        applySetting({ accent: button.dataset.accent }, 'Đã thay đổi màu chủ đạo.');
      });
    });

    document.querySelector('#compactToggle')?.addEventListener('change', event => {
      const previousValue = !event.target.checked;
      const result = SettingsService.saveSettings({ compact: event.target.checked });

      if (!result) {
        event.target.checked = previousValue;
        showStorageError();
        return;
      }

      App.applySettings();
      Toast.show('Đã cập nhật mật độ hiển thị.', 'info');
    });
  };

  const createBackup = () => {
    const result = BackupService.createBackup();

    if (!result) {
      showStorageError();
      return;
    }

    Toast.show('Đã tạo bản sao lưu.');
    renderBackups();
  };

  const handleBackupListClick = async event => {
    const item = event.target.closest('[data-backup-id]');
    const actionButton = event.target.closest('[data-backup-action]');

    if (!item || !actionButton) {
      return;
    }

    const backupId = item.dataset.backupId;

    if (actionButton.dataset.backupAction === 'restore') {
      const accepted = await ConfirmDialog.confirm({
        title: 'Khôi phục bản sao lưu?',
        message: 'Dữ liệu hiện tại sẽ được thay thế bằng dữ liệu trong bản sao lưu.',
        confirmText: 'Khôi phục',
        type: 'warning'
      });

      if (!accepted) {
        return;
      }

      if (!BackupService.restoreBackup(backupId)) {
        Toast.show('Không thể khôi phục bản sao lưu.', 'error');
        return;
      }

      App.applySettings();
      Toast.show('Đã khôi phục bản sao lưu.');
      refresh();
      return;
    }

    if (actionButton.dataset.backupAction === 'delete') {
      if (!BackupService.deleteBackup(backupId)) {
        showStorageError();
        return;
      }

      Toast.show('Đã xóa bản sao lưu.', 'info');
      renderBackups();
    }
  };

  const validateImportFile = file => {
    if (!Utils.isJSONFile(file)) {
      throw new Error('Chỉ chọn tệp sao lưu được tạo từ TaskFlow.');
    }

    if (Number(file.size) > 5 * 1024 * 1024) {
      throw new Error('Tệp sao lưu vượt quá dung lượng tối đa 5 MB.');
    }
  };

  const openImportConfirmation = (file, data) => new Promise(resolve => {
    const modal = document.querySelector('#importDataModal');
    const fileName = document.querySelector('#importFileName');
    const confirmButton = document.querySelector('#confirmImportData');
    const cancelButton = document.querySelector('#cancelImportData');
    const closeButton = document.querySelector('#closeImportDataModal');
    const actionIcon = confirmButton?.querySelector('[data-import-action-icon]');
    const actionLabel = confirmButton?.querySelector('[data-import-action-label]');
    const modeInputs = [...document.querySelectorAll('[name="importMode"]')];

    if (!modal || !fileName || !confirmButton || !cancelButton || !closeButton ||
      !actionIcon || !actionLabel || modeInputs.length !== 2) {
      console.error('Khung modal nhập dữ liệu trong HTML chưa đầy đủ.');
      resolve(null);
      return;
    }

    let mode = 'merge';
    let saving = false;
    let settled = false;

    const setControlsDisabled = disabled => {
      confirmButton.disabled = disabled;
      cancelButton.disabled = disabled;
      closeButton.disabled = disabled;
      modeInputs.forEach(input => { input.disabled = disabled; });
    };

    const updatePreview = () => {
      const preview = BackupService.previewImport(data, { mode });

      if (!preview.ok) {
        confirmButton.disabled = true;
        Toast.show(preview.message || 'Tệp sao lưu không hợp lệ.', 'error');
        return;
      }

      setModalText(modal, 'tasks', preview.tasksAdded);
      setModalText(modal, 'tasks-skipped', preview.tasksSkipped);
      setModalText(modal, 'categories', preview.categoriesAdded);
      setModalText(modal, 'categories-matched', preview.categoriesMatched);
      modal.querySelector('[data-import-mode-label]').textContent = mode === 'merge' ?
        'Gộp với dữ liệu hiện tại' : 'Thay thế dữ liệu hiện tại';

      const warnings = [];

      if (preview.categoriesSkipped) {
        warnings.push(`${preview.categoriesSkipped} danh mục không hợp lệ hoặc trùng tên bị bỏ qua.`);
      }

      if (preview.taskIdsRegenerated) {
        warnings.push(`${preview.taskIdsRegenerated} công việc trong tệp đã được tạo mã mới để tránh trùng lặp.`);
      }

      if (preview.taskProgressFixed) {
        warnings.push(`${preview.taskProgressFixed} tiến độ không hợp lệ đã được điều chỉnh.`);
      }

      if (mode === 'overwrite') {
        warnings.push('Dữ liệu hiện tại sẽ được thay thế sau khi bạn xác nhận.');
      }

      modal.querySelector('[data-import-warning]').textContent = warnings.length ? ` ${warnings.join(' ')}` : '';
      actionLabel.textContent = mode === 'merge' ? 'Gộp dữ liệu' : 'Thay thế dữ liệu';
      actionIcon.dataset.icon = mode === 'merge' ? 'upload' : 'warning';
      App.renderIcons(confirmButton);
    };

    const cleanup = () => {
      modeInputs.forEach(input => input.removeEventListener('change', handleModeChange));
      cancelButton.removeEventListener('click', handleCancel);
      confirmButton.removeEventListener('click', handleConfirm);
    };

    const settle = (result, shouldClose = true) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (shouldClose) {
        Modal.close(modal);
      }

      resolve(result);
    };

    const handleModeChange = event => {
      if (!saving && event.currentTarget.checked) {
        mode = event.currentTarget.value === 'overwrite' ? 'overwrite' : 'merge';
        updatePreview();
      }
    };

    const handleCancel = () => {
      if (!saving) {
        settle(null);
      }
    };

    const handleConfirm = () => {
      if (saving) {
        return;
      }

      saving = true;
      setControlsDisabled(true);
      const result = BackupService.importData(data, { mode });

      if (!result.ok) {
        saving = false;
        setControlsDisabled(false);
        Toast.show(result.message || 'Không thể khôi phục từ tệp sao lưu.', 'error', 5200);
        return;
      }

      settle(result);
    };

    fileName.textContent = String(file.name || 'taskflow-backup');
    modeInputs.forEach(input => {
      input.checked = input.value === 'merge';
      input.disabled = false;
      input.addEventListener('change', handleModeChange);
    });
    confirmButton.disabled = false;
    cancelButton.disabled = false;
    closeButton.disabled = false;
    cancelButton.addEventListener('click', handleCancel);
    confirmButton.addEventListener('click', handleConfirm);
    Modal.bindFrame(modal, '#closeImportDataModal');
    updatePreview();
    Modal.showFrame(modal, { onClose: () => settle(null, false) });
  });

  const handleImportFile = async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file || importBusy) {
      return;
    }

    importBusy = true;
    input.disabled = true;

    try {
      validateImportFile(file);
      const data = await Utils.readJSONFile(file);
      const result = await openImportConfirmation(file, data);

      if (result) {
        App.applySettings();
        const skipped = result.tasksSkipped || result.categoriesSkipped ?
          ` Đã bỏ qua ${result.tasksSkipped || 0} công việc và ${result.categoriesSkipped || 0} danh mục.` :
          '';
        Toast.show(
          `Đã ${result.mode === 'merge' ? 'gộp' : 'ghi đè'} ${result.tasksAdded} công việc và ${result.categoriesAdded} danh mục.${skipped}`,
          'success',
          5200
        );
        refresh();
      }
    } catch (error) {
      console.warn('Tệp sao lưu bị từ chối:', error?.message || error);
      Toast.show(error?.message || 'Không thể khôi phục từ tệp sao lưu.', 'error', 4800);
    } finally {
      input.value = '';
      input.disabled = false;
      importBusy = false;
    }
  };

  const bindBackupAndImportActions = () => {
    document.querySelector('#quickBackup')?.addEventListener('click', createBackup);
    document.querySelector('#createBackup')?.addEventListener('click', createBackup);
    document.querySelector('#backupList')?.addEventListener('click', handleBackupListClick);

    const importInput = document.querySelector('#importDataInput');
    document.querySelector('#importData')?.addEventListener('click', () => {
      if (!importBusy) {
        importInput?.click();
      }
    });
    importInput?.addEventListener('change', handleImportFile);
    document.querySelector('#exportData')?.addEventListener('click', () => {
      try {
        BackupService.downloadBackup();
        Toast.show('Đã tạo tệp sao lưu.');
      } catch (error) {
        console.error('Không thể tạo tệp sao lưu:', error);
        Toast.show('Không thể tạo tệp sao lưu.', 'error');
      }
    });
  };

  const bindDangerActions = () => {
    const resetSampleButton = document.querySelector('#resetSample');

    if (WorkspaceService.isDemoAccount()) {
      resetSampleButton?.addEventListener('click', async () => {
        const accepted = await ConfirmDialog.confirm({
          title: 'Làm mới không gian trải nghiệm?',
          message: 'Dữ liệu công việc hiện tại sẽ được thay bằng bộ công việc gợi ý.',
          confirmText: 'Làm mới',
          type: 'warning'
        });

        if (!accepted) {
          return;
        }

        const result = WorkspaceService.resetDemoData();

        if (!result.ok) {
          Toast.show(result.message || 'Không thể làm mới không gian trải nghiệm.', 'error');
          return;
        }

        Toast.show('Đã làm mới không gian trải nghiệm.');
        refresh();
      });
    } else {
      resetSampleButton?.closest('.setting-row')?.setAttribute('hidden', '');
    }

    document.querySelector('#clearApp')?.addEventListener('click', async () => {
      const accepted = await ConfirmDialog.confirm({
        title: 'Xóa toàn bộ dữ liệu?',
        message: 'Bạn có chắc muốn xóa toàn bộ dữ liệu? Tất cả công việc, danh mục và thiết lập hiện tại sẽ bị xóa.',
        confirmText: 'Xóa vĩnh viễn'
      });

      if (!accepted) {
        return;
      }

      const result = BackupService.clearAllData();

      if (!result.ok) {
        Toast.show(result.message || 'Không thể xóa toàn bộ dữ liệu.', 'error');
        return;
      }

      Toast.show('Đã xóa toàn bộ dữ liệu.');
      window.setTimeout(() => { window.location.href = 'index.html'; }, 300);
    });
  };

  const openImportPickerFromQuery = () => {
    if (!autoImportPending || activeTab !== 'data') {
      return;
    }

    autoImportPending = false;
    const url = new URL(window.location.href);

    url.searchParams.delete('import');
    window.history.replaceState({}, '', url.href);
    requestAnimationFrame(() => document.querySelector('#importDataInput')?.click());
  };

  const init = () => {
    if (App.page !== 'about') {
      return;
    }

    refresh();
    bindTabs();
    bindAppearanceSettings();
    bindBackupAndImportActions();
    bindDangerActions();
    openImportPickerFromQuery();

    window.addEventListener('taskflow:data-changed', () => {
      if (activeTab === 'data') {
        renderBackups();
      }
    });
  };

  init();
  return { init, refresh };
})();
