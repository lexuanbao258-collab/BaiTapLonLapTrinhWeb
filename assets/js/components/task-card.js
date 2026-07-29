'use strict';

const TaskCard = (() => {
  const statusBadge = status => {
    const item = CONFIG.STATUSES.find(option => option.value === status) ||
      CONFIG.STATUSES[0];

    return `
      <span class="badge status-${item.value}">
        ${Icons.render(item.icon, 14)}${item.label}
      </span>
    `;
  };

  const priorityBadge = priority => {
    const item = CONFIG.PRIORITIES.find(option => option.value === priority) ||
      CONFIG.PRIORITIES[1];

    return `
      <span class="badge priority-${item.value}">
        ${Icons.render('flag', 13)}${item.label}
      </span>
    `;
  };

  const categoryBadge = categoryId => {
    const category = CategoryService.getById(categoryId);

    if (!category) {
      return '<span class="category-chip muted">Chưa phân loại</span>';
    }

    const color = /^#[0-9a-f]{6}$/i.test(category.color || '') ?
      category.color : CONFIG.DEFAULT_CATEGORY_COLOR;

    return `
      <span class="category-chip" style="--category-color:${color}">
        <span>${Utils.escapeHTML(category.icon)}</span>
        ${Utils.escapeHTML(category.name)}
      </span>
    `;
  };

  const getProgress = task => task.status === 'done' ? 100 : Utils.clamp(task.progress, 0, 100);

  const progressBar = task => {
    const progress = getProgress(task);

    return `
      <div class="progress-wrap">
        <div class="progress-meta">
          <span>Tiến độ</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress-track"><span style="width:${progress}%"></span></div>
      </div>
    `;
  };

  const deadlineClass = task => {
    if (Utils.isOverdue(task)) {
      return 'overdue';
    }

    if (Utils.isToday(task.deadline) && task.status !== 'done') {
      return 'today';
    }

    return '';
  };

  const render = (task, options = {}) => {
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const subtasksDone = subtasks.filter(subtask => subtask?.done).length;
    const tags = Array.isArray(task.tags) ? task.tags : [];
    const estimate = Number(task.estimate);
    const hasEstimate = Number.isFinite(estimate) && estimate > 0;
    const safeTaskId = Utils.escapeHTML(task.id);

    return `
      <article
        class="task-card ${task.status === 'done' ? 'is-done' : ''} ${task.pinned ? 'is-pinned' : ''}"
        data-task-id="${safeTaskId}"
        draggable="${options.draggable ? 'true' : 'false'}"
      >
        <div class="task-card-top">
          <button class="task-check" type="button" data-action="toggle"
            title="Đổi trạng thái hoàn thành" aria-label="Đổi trạng thái">
            ${Icons.render(task.status === 'done' ? 'checkCircle' : 'circle', 22)}
          </button>
          <div class="task-title-wrap">
            <h3>${Utils.escapeHTML(task.title)}</h3>
            <div class="task-badges">${priorityBadge(task.priority)}${statusBadge(task.status)}</div>
          </div>
          <div class="task-actions">
            <button class="icon-btn ${task.pinned ? 'active' : ''}" type="button"
              data-action="pin" title="Ghim"
              aria-label="${task.pinned ? 'Bỏ ghim công việc' : 'Ghim công việc'}">
              ${Icons.render('pin', 18)}
            </button>
            <button class="icon-btn" type="button" data-action="more" title="Tác vụ"
              aria-label="Mở menu tác vụ công việc">
              ${Icons.render('more', 19)}
            </button>
          </div>
        </div>
        <p class="task-description">${Utils.escapeHTML(task.description)}</p>
        <div class="task-meta">
          <span class="deadline ${deadlineClass(task)}">
            ${Icons.render('calendar', 15)}${Utils.escapeHTML(Utils.relativeDate(task.deadline))}
          </span>
          ${categoryBadge(task.categoryId)}
          ${hasEstimate ? `<span>${Icons.render('clock', 15)}${estimate}h</span>` : ''}
          ${subtasks.length ? `<span>${Icons.render('tasks', 15)}${subtasksDone}/${subtasks.length}</span>` : ''}
        </div>
        ${tags.length ?
          `<div class="tag-row">${tags.map(tag => `<span>#${Utils.escapeHTML(tag)}</span>`).join('')}</div>` :
          ''}
        ${options.showProgress !== false ? progressBar(task) : ''}
      </article>
    `;
  };

  const renderRow = task => {
    const progress = getProgress(task);
    const safeTaskId = Utils.escapeHTML(task.id);
    const formattedDeadline = Utils.escapeHTML(Utils.formatDate(task.deadline));
    const relativeDeadline = Utils.escapeHTML(Utils.relativeDate(task.deadline));

    return `
      <article class="task-row ${task.status === 'done' ? 'is-done' : ''}" data-task-id="${safeTaskId}">
        <button class="task-check" type="button" data-action="toggle" aria-label="Đổi trạng thái hoàn thành">
          ${Icons.render(task.status === 'done' ? 'checkCircle' : 'circle', 22)}
        </button>
        <div class="task-row-main">
          <div class="task-row-title">
            <h3>${Utils.escapeHTML(task.title)}</h3>
            ${task.pinned ? Icons.render('pin', 14, 'pin-mark') : ''}
          </div>
          <p>${Utils.escapeHTML(task.description)}</p>
          <div class="task-meta compact">
            ${categoryBadge(task.categoryId)}${priorityBadge(task.priority)}${statusBadge(task.status)}
          </div>
        </div>
        <div class="task-row-deadline ${deadlineClass(task)}">
          <small>Deadline</small><strong>${formattedDeadline}</strong><span>${relativeDeadline}</span>
        </div>
        <div class="task-row-progress">
          <strong>${progress}%</strong><div class="progress-track"><span style="width:${progress}%"></span></div>
        </div>
        <div class="task-actions">
          <button class="icon-btn ${task.pinned ? 'active' : ''}" type="button" data-action="pin"
            aria-label="${task.pinned ? 'Bỏ ghim công việc' : 'Ghim công việc'}">
            ${Icons.render('pin', 18)}
          </button>
          <button class="icon-btn" type="button" data-action="more" aria-label="Mở menu tác vụ công việc">
            ${Icons.render('more', 19)}
          </button>
        </div>
      </article>
    `;
  };

  const emptyState = (
    title = 'Chưa có dữ liệu',
    text = 'Hãy thêm nội dung mới để bắt đầu.',
    actionText = '',
    action = ''
  ) => `
    <div class="empty-state">
      <img src="assets/img/empty-state.svg" alt="">
      <h3>${Utils.escapeHTML(title)}</h3>
      <p>${Utils.escapeHTML(text)}</p>
      ${actionText ?
        `<button class="btn btn-primary" type="button" data-empty-action="${Utils.escapeHTML(action)}">${Icons.render('plus', 17)}${Utils.escapeHTML(actionText)}</button>` :
        ''}
    </div>
  `;

  const openMenu = (task, anchor) => {
    document.querySelector('.context-menu')?.remove();

    const menu = document.createElement('div');

    menu.className = 'context-menu';
    menu.setAttribute('role', 'menu');
    menu.dataset.taskId = String(task.id || '');
    menu.innerHTML = `
      <button type="button" role="menuitem" data-action="view">${Icons.render('eye', 17)}Xem chi tiết</button>
      <button type="button" role="menuitem" data-action="edit">${Icons.render('edit', 17)}Chỉnh sửa</button>
      <button type="button" role="menuitem" data-action="duplicate">${Icons.render('copy', 17)}Nhân bản</button>
      <button type="button" role="menuitem" data-action="pin">${Icons.render('pin', 17)}${task.pinned ? 'Bỏ ghim' : 'Ghim công việc'}</button>
      <hr>
      <button type="button" role="menuitem" class="danger" data-action="delete">${Icons.render('trash', 17)}Xóa công việc</button>
    `;
    document.body.appendChild(menu);

    const rect = anchor.getBoundingClientRect();
    const width = 210;

    menu.style.left = `${Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))}px`;
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 12, rect.bottom + 8)}px`;

    const outside = event => {
      if (!menu.contains(event.target) && event.target !== anchor) {
        menu.remove();
        document.removeEventListener('click', outside);
      }
    };

    window.setTimeout(() => document.addEventListener('click', outside), 0);
    return menu;
  };

  return {
    statusBadge,
    priorityBadge,
    categoryBadge,
    progressBar,
    deadlineClass,
    render,
    renderRow,
    emptyState,
    openMenu
  };
})();
