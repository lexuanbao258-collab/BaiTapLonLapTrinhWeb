'use strict';

(() => {
  if (App.page !== 'kanban') {
    return;
  }

  const board = document.querySelector('.kanban-board');
  const addButton = document.querySelector('#addKanban');
  const searchInput = document.querySelector('#kanbanSearch');
  const priorityFilter = document.querySelector('#kanbanPriorityFilter');
  const categoryFilter = document.querySelector('#kanbanCategoryFilter');
  const resetFiltersButton = document.querySelector('#resetKanbanFilters');
  const columns = {
    todo: {
      list: document.querySelector('#todoTaskList'),
      count: document.querySelector('#todoTaskCount'),
      empty: document.querySelector('#todoTaskEmptyState')
    },
    progress: {
      list: document.querySelector('#progressTaskList'),
      count: document.querySelector('#progressTaskCount'),
      empty: document.querySelector('#progressTaskEmptyState')
    },
    done: {
      list: document.querySelector('#doneTaskList'),
      count: document.querySelector('#doneTaskCount'),
      empty: document.querySelector('#doneTaskEmptyState')
    }
  };
  let draggedId = null;

  const requiredElements = [
    board,
    addButton,
    searchInput,
    priorityFilter,
    categoryFilter,
    resetFiltersButton,
    ...Object.values(columns).flatMap(column => {
      return [
        column.list,
        column.count,
        column.empty
      ];
    })
  ];

  if (requiredElements.some(element => !element)) {
    console.error('Trang Kanban chưa có đầy đủ cấu trúc HTML cần thiết.');
    return;
  }

  const renderCategoryOptions = () => {
    const selectedValue = categoryFilter.value || 'all';
    const defaultOption = categoryFilter.querySelector('option[value="all"]');

    categoryFilter.replaceChildren(defaultOption);

    CategoryService.getAll().forEach(category => {
      const option = document.createElement('option');

      option.value = String(category.id || '');
      option.textContent = String(category.name || '');
      categoryFilter.appendChild(option);
    });

    categoryFilter.value = [...categoryFilter.options].some(option => {
      return option.value === selectedValue;
    }) ? selectedValue : 'all';
  };

  const filteredTasks = () => {
    const query = Utils.normalize(searchInput.value);
    const priority = priorityFilter.value;
    const categoryId = categoryFilter.value;

    return TaskService.getTasks().filter(task => {
      const searchableText = Utils.normalize([
        task.title,
        task.description,
        ...(Array.isArray(task.tags) ? task.tags : [])
      ].join(' '));
      const matchesQuery = !query || searchableText.includes(query);
      const matchesPriority = priority === 'all' || task.priority === priority;
      const matchesCategory = categoryId === 'all' ||
        task.categoryId === categoryId;

      return matchesQuery && matchesPriority && matchesCategory;
    });
  };

  const renderColumn = (status, tasks) => {
    const column = columns[status];

    column.list.querySelectorAll('[data-task-id]').forEach(card => {
      card.remove();
    });

    if (tasks.length) {
      column.empty.insertAdjacentHTML(
        'beforebegin',
        tasks.map(task => {
          return UI.taskCard(task, {
            draggable: true,
            showProgress: false
          });
        }).join('')
      );
    }

    column.count.textContent = tasks.length;
    column.empty.hidden = tasks.length > 0;
  };

  const render = () => {
    renderCategoryOptions();

    const tasks = filteredTasks();

    CONFIG.STATUSES.forEach(status => {
      renderColumn(
        status.value,
        tasks.filter(task => task.status === status.value)
      );
    });
  };

  const clearDragState = () => {
    board.querySelectorAll('.task-card.dragging').forEach(card => {
      card.classList.remove('dragging');
    });
    board.querySelectorAll('.kanban-list.drag-over').forEach(list => {
      list.classList.remove('drag-over');
    });
    draggedId = null;
  };

  const bindDragAndDrop = () => {
    board.addEventListener('dragstart', event => {
      const card = event.target.closest('.task-card[draggable="true"]');

      if (!card) {
        return;
      }

      draggedId = card.dataset.taskId;
      card.classList.add('dragging');

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedId);
      }
    });

    board.addEventListener('dragend', clearDragState);

    Object.values(columns).forEach(column => {
      column.list.addEventListener('dragover', event => {
        event.preventDefault();

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }

        column.list.classList.add('drag-over');
      });

      column.list.addEventListener('dragleave', event => {
        if (!column.list.contains(event.relatedTarget)) {
          column.list.classList.remove('drag-over');
        }
      });

      column.list.addEventListener('drop', event => {
        event.preventDefault();
        column.list.classList.remove('drag-over');

        const transferredId = event.dataTransfer ?
          event.dataTransfer.getData('text/plain') :
          '';
        const taskId = draggedId || transferredId;
      const task = TaskService.getTaskById(taskId);
        const nextStatus = column.list.dataset.dropStatus;

        draggedId = null;

        if (!task || task.status === nextStatus) {
          return;
        }

      const result = TaskService.setTaskStatus(taskId, nextStatus);

        if (!UI.mutationSucceeded(result)) {
          UI.toast(UI.mutationErrorMessage(result), 'error');
          render();
          return;
        }

        UI.toast(
          'Đã chuyển sang “' +
        StatisticsService.getStatusLabel(nextStatus) +
          '”.',
          'info'
        );
      });
    });
  };

  const bind = () => {
    addButton.addEventListener('click', () => {
      UI.taskForm();
    });

    document.querySelectorAll('[data-add-status]').forEach(button => {
      button.addEventListener('click', () => {
        UI.taskForm(null, {
          status: button.dataset.addStatus
        });
      });
    });

    searchInput.addEventListener('input', Utils.debounce(render, 180));
    priorityFilter.addEventListener('change', render);
    categoryFilter.addEventListener('change', render);
    resetFiltersButton.addEventListener('click', () => {
      searchInput.value = '';
      priorityFilter.value = 'all';
      categoryFilter.value = 'all';
      render();
      searchInput.focus();
    });

    UI.bindTaskActions(board);
    bindDragAndDrop();
  };

  bind();
  window.addEventListener('taskflow:data-changed', render);
  render();
})();

