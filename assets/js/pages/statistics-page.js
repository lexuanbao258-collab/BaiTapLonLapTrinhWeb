'use strict';

(() => {
  if (App.page !== 'statistics') {
    return;
  }

  const STATUS_COLORS = ['#64748b', '#f59e0b', '#10b981'];
  const STATUS_LABELS = ['Cần làm', 'Đang thực hiện', 'Hoàn thành'];

  const safeChartColor = color => {
    const value = String(color || '').trim();

    return /^#[0-9a-f]{6}$/i.test(value) ?
      value :
      CONFIG.DEFAULT_ACCENT;
  };

  const getAverageEstimate = tasks => {
    if (!tasks.length) {
      return 0;
    }

    const totalEstimate = tasks.reduce((sum, task) => {
      return sum + (Number(task.estimate) || 0);
    }, 0);

    return (totalEstimate / tasks.length).toFixed(1);
  };

  const getBestCategory = (categories, tasks) => {
    return categories
      .map(category => ({
        name: category.name,
        count: tasks.filter(task => {
          return task.categoryId === category.id && task.status === 'done';
        }).length
      }))
      .sort((first, second) => second.count - first.count)[0];
  };

  const weekBars = completedTasks => {
    const start = Utils.startOfWeek(new Date());
    const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    return Array.from({
      length: 7
    }, (_, index) => {
      const date = new Date(start);

      date.setDate(start.getDate() + index);

      const isoDate = Utils.toISODate(date);
      const count = completedTasks.filter(task => {
        if (!task.completedAt) {
          return false;
        }

        return Utils.toISODate(new Date(task.completedAt)) === isoDate;
      }).length;

      return {
        label: dayLabels[index],
        count
      };
    }).map(item => {
      const height = Math.max(3, item.count * 28);

      return `
        <div class="week-bar">
          <strong>${item.count}</strong>
          <div class="week-bar-track">
            <i style="height:${height}px"></i>
          </div>
          <small>${item.label}</small>
        </div>
      `;
    }).join('');
  };

  const overdueItem = task => {
    const taskId = Utils.escapeHTML(task.id);
    const deadline = Utils.escapeHTML(Utils.formatDate(task.deadline, true));
    const relativeDeadline = Utils.escapeHTML(Utils.relativeDate(task.deadline));

    return `
      <div class="today-item" data-task-id="${taskId}">
        <span class="stat-icon danger statistics-overdue-icon">
          ${Icons.render('warning', 17)}
        </span>
        <div class="today-main">
          <h3>${Utils.escapeHTML(task.title)}</h3>
          <p>${UI.categoryBadge(task.categoryId)}</p>
        </div>
        <div class="today-time overdue">
          <strong>${deadline}</strong>
          <small>${relativeDeadline}</small>
        </div>
      </div>
    `;
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = value;
    }
  };

  const setupCanvas = canvas => {
    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;

    const context = canvas.getContext('2d');

    context.scale(devicePixelRatio, devicePixelRatio);

    return {
      context,
      width: rect.width,
      height: rect.height
    };
  };

  const drawDonut = (id, values, colors, labels, legendId, textColor) => {
    const canvas = document.getElementById(id);

    if (!canvas) {
      return;
    }

    const canvasData = setupCanvas(canvas);
    const context = canvasData.context;
    const width = canvasData.width;
    const height = canvasData.height;
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    const centerX = width / 2;
    const centerY = height / 2 - 4;
    const radius = Math.min(width, height) * 0.3;
    let startAngle = -Math.PI / 2;

    values.forEach((value, index) => {
      const angle = value / total * Math.PI * 2;

      context.beginPath();
      context.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      context.arc(
        centerX,
        centerY,
        radius * 0.62,
        startAngle + angle,
        startAngle,
        true
      );
      context.closePath();
      context.fillStyle = safeChartColor(colors[index]);
      context.fill();
      startAngle += angle;
    });

    const completion = Math.round(values[2] / total * 100);

    context.fillStyle = textColor;
    context.textAlign = 'center';
    context.font = '700 26px Be Vietnam Pro';
    context.fillText(`${completion}%`, centerX, centerY + 5);
    context.font = '500 10px Be Vietnam Pro';
    context.fillText('hoàn thành', centerX, centerY + 24);

    renderLegend(legendId, labels, colors, values);
  };

  const roundRect = (context, x, y, width, height, radius) => {
    context.beginPath();

    if (context.roundRect) {
      context.roundRect(x, y, width, height, radius);
      return;
    }

    context.rect(x, y, width, height);
  };

  const drawGrid = (context, width, padding, chartHeight, gridColor) => {
    context.strokeStyle = gridColor;
    context.lineWidth = 1;

    for (let index = 0; index <= 4; index += 1) {
      const y = padding.top + chartHeight * index / 4;

      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();
    }
  };

  const drawBars = (id, values, labels, colors, legendId, textColor, gridColor) => {
    const canvas = document.getElementById(id);

    if (!canvas) {
      return;
    }

    const canvasData = setupCanvas(canvas);
    const context = canvasData.context;
    const width = canvasData.width;
    const height = canvasData.height;
    const padding = {
      left: 34,
      right: 15,
      top: 20,
      bottom: 34
    };
    const maxValue = Math.max(...values, 1);
    const chartHeight = height - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;
    const slotWidth = chartWidth / Math.max(values.length, 1);
    const barWidth = Math.min(48, slotWidth * 0.55);

    drawGrid(context, width, padding, chartHeight, gridColor);

    values.forEach((value, index) => {
      const barHeight = value / maxValue * (chartHeight - 8);
      const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;
      const label = String(labels[index] || '');
      const shortLabel = label.length > 12 ? `${label.slice(0, 10)}…` : label;

      context.fillStyle = safeChartColor(colors[index]);
      roundRect(context, x, y, barWidth, barHeight, 8);
      context.fill();
      context.fillStyle = textColor;
      context.textAlign = 'center';
      context.font = '600 10px Be Vietnam Pro';
      context.fillText(value, x + barWidth / 2, y - 7);
      context.font = '500 9px Be Vietnam Pro';
      context.fillText(shortLabel, x + barWidth / 2, height - 10);
    });

    renderLegend(legendId, labels, colors, values);
  };

  const renderLegend = (id, labels, colors, values) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.innerHTML = labels.map((label, index) => {
      const safeLabel = Utils.escapeHTML(label);
      const color = safeChartColor(colors[index]);

      return `<span><i style="background:${color}"></i>${safeLabel} (${values[index]})</span>`;
    }).join('');
  };

  const drawAll = (tasks, categories) => {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-soft').trim() || '#64748b';
    const gridColor = style.getPropertyValue('--border').trim() || '#e5e7eb';
    const statusValues = STATUS_LABELS.map((label, index) => {
      const status = ['todo', 'progress', 'done'][index];

      return tasks.filter(task => task.status === status).length;
    });
    const priorityValues = CONFIG.PRIORITIES.map(priority => {
      return tasks.filter(task => task.priority === priority.value).length;
    });
    const priorityLabels = CONFIG.PRIORITIES.map(priority => priority.label);
    const priorityColors = CONFIG.PRIORITIES.map(priority => priority.color);
    const categoryData = categories
      .map(category => ({
        label: category.name,
        color: category.color,
        value: tasks.filter(task => task.categoryId === category.id).length
      }))
      .sort((first, second) => second.value - first.value)
      .slice(0, 6);

    drawDonut(
      'statusChart',
      statusValues,
      STATUS_COLORS,
      STATUS_LABELS,
      'statusLegend',
      textColor
    );
    drawBars(
      'priorityChart',
      priorityValues,
      priorityLabels,
      priorityColors,
      'priorityLegend',
      textColor,
      gridColor
    );
    drawBars(
      'categoryChart',
      categoryData.map(category => category.value),
      categoryData.map(category => category.label),
      categoryData.map(category => category.color),
      'categoryLegend',
      textColor,
      gridColor
    );
  };

  const render = () => {
    const tasks = TaskService.getTasks();
    const stats = StatisticsService.calculateTaskStats(tasks);
    const categories = CategoryService.getAll();
    const completedTasks = tasks.filter(task => task.status === 'done');
    const averageEstimate = getAverageEstimate(tasks);
    const bestCategory = getBestCategory(categories, tasks);
    const overdueTasks = tasks
      .filter(Utils.isOverdue)
      .sort((first, second) => {
        return String(first.deadline || '').localeCompare(
          String(second.deadline || '')
        );
      });
    const overdueList = document.querySelector('#overdueStatisticsList');
    const overdueEmpty = document.querySelector('#overdueStatisticsEmpty');
    const hasOverdue = overdueTasks.length > 0;

    setText('#statisticsCompletionRate', `${stats.completion}%`);
    setText('#statisticsCompletedCount', stats.done);
    setText('#statisticsOverdueCount', stats.overdue);
    setText('#statisticsAverageEstimate', `${averageEstimate}h`);
    setText('#bestCategoryName', bestCategory?.name || 'Chưa có');
    setText(
      '#bestCategoryCount',
      `${bestCategory?.count || 0} công việc hoàn thành`
    );
    setText('#highPriorityCount', stats.high);
    setText('#pinnedTaskCount', stats.pinned);

    document.querySelector('#statisticsWeekBars').innerHTML =
      weekBars(completedTasks);
    overdueList.hidden = !hasOverdue;
    overdueList.innerHTML = hasOverdue ?
      overdueTasks.slice(0, 5).map(overdueItem).join('') :
      '';
    overdueEmpty.hidden = hasOverdue;

    drawAll(tasks, categories);
  };

  const bind = () => {
    UI.bindTaskActions(document.querySelector('#overdueStatisticsList'));
  };

  let resizeTimer;

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      drawAll(TaskService.getTasks(), CategoryService.getAll());
    }, 180);
  });
  window.addEventListener('taskflow:data-changed', render);

  bind();
  render();
})();

