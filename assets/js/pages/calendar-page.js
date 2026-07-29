'use strict';

(() => {
  if (App.page !== 'calendar') {
    return;
  }

  let current = new Date();
  let selected = Utils.todayISO();

  current.setDate(1);

  const renderDayTask = task => {
    const category = CategoryService.getById(task.categoryId);
    const categoryColor = /^#[0-9a-fA-F]{6}$/.test(category?.color || '') ?
      category.color :
      CONFIG.DEFAULT_CATEGORY_COLOR;

    return `
      <span
        class="day-task"
        data-task="${Utils.escapeHTML(task.id)}"
        style="--task-color:${categoryColor}"
      >
        <i></i>${Utils.escapeHTML(task.title)}
      </span>
    `;
  };

  const dayCell = (date, month) => {
    const iso = Utils.toISODate(date);
    const tasks = TaskService.getTasks().filter(task => task.deadline === iso);
    const classes = [
      'calendar-day',
      date.getMonth() !== month ? 'other-month' : '',
      iso === Utils.todayISO() ? 'today-date' : '',
      iso === selected ? 'selected' : ''
    ].filter(Boolean).join(' ');
    const visibleTasks = tasks
      .slice(0, 3)
      .map(renderDayTask)
      .join('');
    const remainingTasks = tasks.length > 3 ?
      `<span class="more-tasks">+${tasks.length - 3} công việc</span>` :
      '';

    return `
      <button
        class="${classes}"
        type="button"
        data-date="${iso}"
        aria-label="${Utils.escapeHTML(Utils.formatDate(iso, true))}, ${tasks.length} công việc"
      >
        <span class="day-number">${date.getDate()}</span>
        <span class="day-tasks">${visibleTasks}${remainingTasks}</span>
      </button>
    `;
  };

  const renderAgendaItem = task => `
    <article
      class="agenda-item"
      data-task-id="${Utils.escapeHTML(task.id)}"
    >
      <div class="task-badges">
        ${UI.priorityBadge(task.priority)}
        ${UI.statusBadge(task.status)}
      </div>
      <h3 class="agenda-item-title">${Utils.escapeHTML(task.title)}</h3>
      <p>${Utils.escapeHTML(task.description)}</p>
      <div class="task-actions">
        <button class="btn btn-mini btn-soft" type="button" data-action="view">
          ${Icons.render('eye', 14)}Chi tiết
        </button>
        <button class="btn btn-mini btn-ghost" type="button" data-action="toggle">
          ${Icons.render('check', 14)}Đổi trạng thái
        </button>
      </div>
    </article>
  `;

  const getAgendaData = date => {
    const parsedDate = Utils.parseDate(date);
    const tasks = TaskService.getTasks()
      .filter(task => task.deadline === date)
      .sort((first, second) => first.status.localeCompare(second.status));
    const dayName = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      month: 'long',
      year: 'numeric'
    }).format(parsedDate);

    return {
      parsedDate,
      tasks,
      dayName
    };
  };

  const renderAgenda = () => {
    const data = getAgendaData(selected);
    const list = document.querySelector('#agendaList');
    const emptyState = document.querySelector('#agendaEmptyState');
    const hasTasks = data.tasks.length > 0;

    document.querySelector('#agendaDayNumber').textContent =
      data.parsedDate.getDate();
    document.querySelector('#agendaDayLabel').textContent = data.dayName;
    list.hidden = !hasTasks;
    list.innerHTML = hasTasks ? data.tasks.map(renderAgendaItem).join('') : '';
    emptyState.hidden = hasTasks;
  };

  const renderCalendar = () => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - offset);
    const days = Array.from({
      length: 42
    }, (_, index) => {
      const date = new Date(gridStart);

      date.setDate(gridStart.getDate() + index);
      return date;
    });

    document.querySelector('#calendarMonthTitle').textContent =
      `Tháng ${month + 1}, ${year}`;
    document.querySelector('#calendarGrid').innerHTML = days
      .map(date => dayCell(date, month))
      .join('');
    renderAgenda();
  };

  const handleAgendaAction = event => {
    const item = event.target.closest('[data-task-id]');
    const action = event.target.closest('[data-action]')?.dataset.action;

    if (!item || !action) {
      return;
    }

      const task = TaskService.getTaskById(item.dataset.taskId);

    if (!task) {
      return;
    }

    if (action === 'view') {
      UI.taskDetail(task);
      return;
    }

    if (action === 'toggle') {
      const result = TaskService.toggleTaskStatus(task.id);

      if (!UI.mutationSucceeded(result)) {
        UI.toast(UI.mutationErrorMessage(result), 'error');
        return;
      }

      UI.toast('Đã cập nhật trạng thái.');
    }
  };

  const handleCalendarClick = event => {
    const taskId = event.target.closest('[data-task]')?.dataset.task;

    if (taskId) {
      event.stopPropagation();

      const task = TaskService.getTaskById(taskId);

      if (task) {
        UI.taskDetail(task);
      }

      return;
    }

    const date = event.target.closest('[data-date]')?.dataset.date;

    if (!date) {
      return;
    }

    selected = date;
    renderCalendar();
  };

  const bind = () => {
    document.querySelector('#prevMonth').addEventListener('click', () => {
      current.setMonth(current.getMonth() - 1);
      renderCalendar();
    });

    document.querySelector('#nextMonth').addEventListener('click', () => {
      current.setMonth(current.getMonth() + 1);
      renderCalendar();
    });

    document.querySelector('#todayBtn').addEventListener('click', () => {
      current = new Date();
      current.setDate(1);
      selected = Utils.todayISO();
      renderCalendar();
    });

    document.querySelector('#addCalendar').addEventListener('click', () => {
      UI.taskForm(null, {
        deadline: selected
      });
    });

    document.querySelector('#addAgendaTask').addEventListener('click', () => {
      UI.taskForm(null, {
        deadline: selected
      });
    });

    document.querySelector('#calendarGrid').addEventListener(
      'click',
      handleCalendarClick
    );
    document.querySelector('#agendaList').addEventListener(
      'click',
      handleAgendaAction
    );
  };

  bind();
  renderCalendar();
  window.addEventListener('taskflow:data-changed', renderCalendar);
})();

