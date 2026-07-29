'use strict';

const TaskDetail = (() => {
  const show = task => {
    if (!task) {
      Toast.show('Không tìm thấy công việc.', 'error');
      return null;
    }

    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const tags = Array.isArray(task.tags) ? task.tags : [];
    const completedSubtasks = subtasks.filter(subtask => subtask?.done).length;
    const formattedDeadline = Utils.escapeHTML(Utils.formatDate(task.deadline));
    const formattedCreatedAt = Utils.escapeHTML(Utils.formatDateTime(task.createdAt));
    const estimate = Number(task.estimate);
    const safeEstimate = Number.isFinite(estimate) ? estimate : 0;
    const content = `
      <div class="detail-hero">
        <div>
          <div class="task-badges">${TaskCard.priorityBadge(task.priority)}${TaskCard.statusBadge(task.status)}</div>
          <h2>${Utils.escapeHTML(task.title)}</h2>
          <p>${Utils.escapeHTML(task.description)}</p>
        </div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><span>Danh mục</span>${TaskCard.categoryBadge(task.categoryId)}</div>
        <div class="detail-item">
          <span>Deadline</span><strong>${formattedDeadline}</strong>
          <small class="${TaskCard.deadlineClass(task)}">${Utils.escapeHTML(Utils.relativeDate(task.deadline))}</small>
        </div>
        <div class="detail-item"><span>Thời gian dự kiến</span><strong>${safeEstimate} giờ</strong></div>
        <div class="detail-item"><span>Ngày tạo</span><strong>${formattedCreatedAt}</strong></div>
      </div>
      ${TaskCard.progressBar(task)}
      <section class="detail-section">
        <div class="section-heading"><h3>Checklist</h3><span>${completedSubtasks}/${subtasks.length}</span></div>
        ${subtasks.length ?
          `<div class="subtask-list readonly">${subtasks.map(subtask => `
            <div class="subtask-item ${subtask?.done ? 'done' : ''}">
              ${Icons.render(subtask?.done ? 'checkCircle' : 'circle', 18)}
              <span>${Utils.escapeHTML(subtask?.title)}</span>
            </div>
          `).join('')}</div>` :
          '<p class="muted-text">Chưa có công việc con.</p>'}
      </section>
      ${task.notes ?
        `<section class="detail-section"><h3>Ghi chú</h3><p class="note-box">${Utils.escapeHTML(task.notes)}</p></section>` :
        ''}
      ${tags.length ?
        `<section class="detail-section"><h3>Nhãn</h3><div class="tag-row large">${tags.map(tag => `<span>#${Utils.escapeHTML(tag)}</span>`).join('')}</div></section>` :
        ''}
    `;
    const modal = document.querySelector('#taskDetailModal');
    const titleElement = document.querySelector('#taskDetailModalTitle');
    const body = document.querySelector('#taskDetailBody');
    const editButton = document.querySelector('#taskDetailEditButton');

    if (!modal || !titleElement || !body || !editButton) {
      console.error('Khung #taskDetailModal trong HTML chưa đầy đủ.');
      Toast.show('Không thể mở chi tiết công việc.', 'error');
      return null;
    }

    titleElement.textContent = 'Chi tiết công việc';
    body.innerHTML = content;
    modal.taskFlowTask = task;
    modal.taskFlowReset = () => {
      body.replaceChildren();
      modal.taskFlowTask = null;
    };

    if (!modal.taskFlowDetailBound) {
      modal.taskFlowDetailBound = true;
      editButton.addEventListener('click', () => {
        if (modal.taskFlowTask) {
          TaskForm.open(modal.taskFlowTask);
        }
      });
    }

    Modal.bindFrame(modal, '[data-task-detail-close]');
    return Modal.showFrame(modal);
  };

  return { show };
})();

const TaskForm = (() => {
  const setFieldError = (form, name, message = '') => {
    const field = form.elements.namedItem(name);

    if (!field || typeof field.closest !== 'function') {
      return;
    }

    field.classList.toggle('invalid', Boolean(message));
    field.closest('.form-field')?.querySelector('.field-error')?.replaceChildren(
      document.createTextNode(message)
    );
  };

  const showFieldErrors = (form, errors) => {
    form.querySelectorAll('.field-error').forEach(element => {
      element.textContent = '';
    });
    form.querySelectorAll('.field-control').forEach(element => {
      element.classList.remove('invalid');
    });

    Object.entries(errors || {}).forEach(([name, message]) => {
      setFieldError(form, name, message);
    });
  };

  const renderSubtaskInput = subtask => `
    <div class="subtask-edit-row" data-subtask-id="${Utils.escapeHTML(subtask?.id || '')}">
      <input type="checkbox" aria-label="Hoàn thành công việc con" ${subtask?.done ? 'checked' : ''}>
      <input type="text" maxlength="120" aria-label="Tên công việc con"
        value="${Utils.escapeHTML(subtask?.title || '')}" placeholder="Tên công việc con">
      <button type="button" class="icon-btn" data-remove-subtask aria-label="Xóa công việc con">
        ${Icons.render('close', 16)}
      </button>
    </div>
  `;

  const bindSubtaskRemoval = form => {
    if (form.taskFlowSubtaskRemoveBound) {
      return;
    }

    form.taskFlowSubtaskRemoveBound = true;
    form.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-subtask]');

      if (button && form.contains(button)) {
        button.closest('.subtask-edit-row')?.remove();
      }
    });
  };

  const populateCategoryOptions = (categorySelect, categories, selectedCategoryId) => {
    if (!categorySelect) {
      return;
    }

    let defaultOption = [...categorySelect.options].find(option => option.value === '');

    if (!defaultOption) {
      defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Chưa phân loại';
    }

    categorySelect.replaceChildren(defaultOption);
    categories.forEach(category => {
      const option = document.createElement('option');

      option.value = String(category.id || '');
      option.textContent = `${String(category.icon || '').trim()} ${String(category.name || '').trim()}`.trim();
      categorySelect.appendChild(option);
    });
    categorySelect.value = String(selectedCategoryId || '');

    if (categorySelect.value !== String(selectedCategoryId || '')) {
      categorySelect.value = '';
    }
  };

  const setSaveButtonLabel = (button, label) => {
    if (!button) {
      return;
    }

    const labelElement = button.querySelector('[data-task-save-label], [data-save-task-label]');

    if (labelElement) {
      labelElement.textContent = label;
    } else {
      const textNode = [...button.childNodes].reverse().find(node => node.nodeType === 3);

      if (textNode) {
        textNode.textContent = ` ${label}`;
      } else {
        button.appendChild(document.createTextNode(label));
      }
    }

    button.setAttribute('aria-label', label);
  };

  const fill = (form, current, categories, isEdit) => {
    const setValue = (name, value) => {
      const control = form.elements.namedItem(name);

      if (control && 'value' in control) {
        control.value = String(value ?? '');
      }
    };
    const tags = Array.isArray(current.tags) ? current.tags : [];
    const subtasks = Array.isArray(current.subtasks) ? current.subtasks : [];
    const progress = Utils.clamp(current.progress, 0, 100);
    const categorySelect = form.querySelector('#taskCategory');
    const subtaskEditor = form.querySelector('[data-subtask-editor]');
    const characterCount = form.querySelector('[data-char-count]');
    const range = form.elements.namedItem('progress');
    const rangeOutput = range?.closest('.range-field')?.querySelector('output');
    const pinned = form.elements.namedItem('pinned');
    const idField = form.querySelector('#taskId');

    form.reset();
    showFieldErrors(form, {});
    setValue('title', current.title);
    setValue('description', current.description);
    setValue('deadline', current.deadline);
    setValue('priority', current.priority);
    setValue('status', current.status);
    setValue('estimate', current.estimate);
    setValue('progress', progress);
    setValue('tags', tags.join(', '));
    setValue('notes', current.notes);

    if (idField) {
      idField.value = String(current.id || '');
    }

    if (pinned && 'checked' in pinned) {
      pinned.checked = Boolean(current.pinned);
    }

    populateCategoryOptions(categorySelect, categories, current.categoryId);

    if (subtaskEditor) {
      subtaskEditor.innerHTML = subtasks.map(renderSubtaskInput).join('');
    }

    if (characterCount) {
      characterCount.textContent = `${String(current.description || '').length}/1000`;
    }

    if (rangeOutput) {
      rangeOutput.value = `${progress}%`;
      rangeOutput.textContent = `${progress}%`;
    }

    const titleElement = document.querySelector('#taskModalTitle');
    const saveButton = document.querySelector('#saveTaskButton');

    if (titleElement) {
      titleElement.textContent = isEdit ? 'Chỉnh sửa công việc' : 'Thêm công việc mới';
    }

    setSaveButtonLabel(saveButton, isEdit ? 'Lưu thay đổi' : 'Thêm công việc');
  };

  const collect = (form, task) => ({
    id: task?.id,
    originalDeadline: form.dataset.originalDeadline || '',
    title: form.elements.title.value,
    description: form.elements.description.value,
    deadline: form.elements.deadline.value,
    categoryId: form.elements.categoryId.value,
    priority: form.elements.priority.value,
    status: form.elements.status.value,
    estimate: form.elements.estimate.value,
    progress: form.elements.progress.value,
    tags: form.elements.tags.value,
    notes: form.elements.notes.value,
    pinned: form.elements.pinned.checked,
    subtasks: [...form.querySelectorAll('.subtask-edit-row')].map(row => ({
      id: row.dataset.subtaskId || undefined,
      done: row.querySelector('[type="checkbox"]').checked,
      title: row.querySelector('[type="text"]').value
    }))
  });

  const resetContext = form => {
    if (!form) {
      return;
    }

    delete form.dataset.originalDeadline;
    delete form.dataset.submitting;
    form.taskFlowTask = null;
    form.taskFlowIsEdit = false;
  };

  const bindInputs = form => {
    if (form.taskFlowInputsBound) {
      return;
    }

    form.taskFlowInputsBound = true;
    const description = form.elements.description;
    const count = form.querySelector('[data-char-count]');
    const range = form.elements.progress;

    description?.addEventListener('input', () => {
      if (count) {
        count.textContent = `${description.value.length}/1000`;
      }
    });

    range?.addEventListener('input', () => {
      const output = range.closest('.range-field')?.querySelector('output');

      if (output) {
        output.value = `${range.value}%`;
        output.textContent = `${range.value}%`;
      }
    });

    form.querySelector('[data-add-subtask]')?.addEventListener('click', () => {
      form.querySelector('[data-subtask-editor]')?.insertAdjacentHTML(
        'beforeend',
        renderSubtaskInput({ title: '', done: false })
      );
    });
    bindSubtaskRemoval(form);

    ['title', 'description', 'deadline'].forEach(name => {
      form.elements[name]?.addEventListener('input', Utils.debounce(() => {
        const validation = Validators.task(collect(form, form.taskFlowTask));

        setFieldError(form, name, validation.errors[name] || '');
      }, 150));
    });
  };

  const setSubmitting = (form, saveButton, submitting) => {
    form.dataset.submitting = submitting ? '1' : '';
    saveButton.disabled = submitting;
    saveButton.setAttribute('aria-busy', String(submitting));
  };

  const save = async ({ event, form, modal, task, isEdit, saveButton }) => {
    event.preventDefault();

    if (form.dataset.submitting === '1') {
      return;
    }

    const data = collect(form, task);
    const validation = Validators.task(data);

    if (!validation.valid) {
      showFieldErrors(form, validation.errors);
      form.querySelector('.field-control.invalid')?.focus();
      Toast.show('Vui lòng kiểm tra lại thông tin.', 'error');
      return;
    }

    setSubmitting(form, saveButton, true);

    try {
      const mutation = isEdit ?
        TaskService.updateTask(task.id, data) :
        TaskService.createTask(data);
      const result = await Promise.resolve(mutation);

      if (!Toast.mutationSucceeded(result)) {
        const errors = result?.errors || {};
        const hasFieldErrors = Object.keys(errors).some(name => Boolean(form.elements.namedItem(name)));

        showFieldErrors(form, errors);
        Toast.show(Toast.mutationErrorMessage(result, hasFieldErrors), 'error');
        return;
      }

      resetContext(form);
      Modal.close(modal);
      Toast.show(isEdit ? 'Đã cập nhật công việc.' : 'Đã thêm công việc mới.');
    } catch (error) {
      console.error('Không thể lưu công việc:', error);
      Toast.show(Toast.STORAGE_ERROR_MESSAGE, 'error');
    } finally {
      if (form.isConnected) {
        setSubmitting(form, saveButton, false);
      }
    }
  };

  const open = (task = null, defaults = {}) => {
    const modal = document.querySelector('#taskModal');
    const form = document.querySelector('#taskForm');
    const dialog = document.querySelector('#taskModalDialog');
    const cancelButton = document.querySelector('#cancelTaskButton');
    const saveButton = document.querySelector('#saveTaskButton');

    if (!modal || !form || !dialog || !cancelButton || !saveButton) {
      console.error('Khung #taskModal trong HTML chưa đầy đủ.');
      Toast.show('Không thể mở biểu mẫu công việc.', 'error');
      return null;
    }

    const isEdit = Boolean(task?.id);
    const current = {
      title: '',
      description: '',
      deadline: Utils.todayISO(),
      priority: 'medium',
      status: 'todo',
      categoryId: '',
      tags: [],
      pinned: false,
      estimate: '',
      progress: 0,
      subtasks: [],
      notes: '',
      ...defaults,
      ...(task || {})
    };

    form.taskFlowTask = task;
    form.taskFlowIsEdit = isEdit;
    form.dataset.originalDeadline = isEdit ? String(task.deadline || '') : '';
    fill(form, current, CategoryService.getAll(), isEdit);
    bindInputs(form);

    if (!modal.taskFlowTaskFormBound) {
      modal.taskFlowTaskFormBound = true;
      cancelButton.addEventListener('click', () => Modal.close(modal));
      form.addEventListener('submit', event => {
        save({
          event,
          form,
          modal,
          task: form.taskFlowTask,
          isEdit: Boolean(form.taskFlowIsEdit),
          saveButton
        });
      });
    }

    modal.taskFlowReset = () => {
      resetContext(form);
      form.reset();
      form.querySelector('[data-subtask-editor]')?.replaceChildren();
      showFieldErrors(form, {});
    };

    Modal.bindFrame(modal, '[data-task-modal-close]');
    return Modal.showFrame(modal);
  };

  return {
    open,
    showFieldErrors,
    setFieldError
  };
})();
