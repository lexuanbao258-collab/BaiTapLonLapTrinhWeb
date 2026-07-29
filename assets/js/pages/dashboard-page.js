'use strict';

(() => {
  if (App.page !== 'dashboard') {
    return;
  }

  const compareDeadlines = (firstTask, secondTask) => {
    const firstDeadline = String(firstTask.deadline || '');
    const secondDeadline = String(secondTask.deadline || '');

    return firstDeadline.localeCompare(secondDeadline);
  };

  const getTodayTasks = tasks => {
    return tasks
      .filter(task => {
        const needsAttention = Utils.isToday(task.deadline) ||
          Utils.isOverdue(task);

        return task.status !== 'done' && needsAttention;
      })
      .sort(compareDeadlines)
      .slice(0, 6);
  };

  const getUpcomingTasks = tasks => {
    const today = Utils.todayISO();

    return tasks
      .filter(task => task.status !== 'done' && task.deadline >= today)
      .sort(compareDeadlines)
      .slice(0, 5);
  };

  const getRecentTasks = tasks => {
    return [...tasks]
      .sort((firstTask, secondTask) => {
        const firstTime = new Date(
          firstTask.updatedAt || firstTask.createdAt || 0
        ).getTime();
        const secondTime = new Date(
          secondTask.updatedAt || secondTask.createdAt || 0
        ).getTime();

        return secondTime - firstTime;
      })
      .slice(0, 5);
  };

  const greeting = () => {
    const hour = new Date().getHours();

    if (hour < 11) {
      return 'Chào buổi sáng';
    }

    if (hour < 18) {
      return 'Chào buổi chiều';
    }

    return 'Chào buổi tối';
  };

  const heroMessage = stats => {
    if (stats.overdue) {
      return `Bạn có ${stats.overdue} công việc quá hạn và ${stats.today} công việc cần hoàn thành hôm nay. Hãy xử lý việc quan trọng nhất trước.`;
    }

    if (stats.today) {
      return `Hôm nay bạn có ${stats.today} công việc cần hoàn thành. Mỗi bước nhỏ đều đưa bạn gần mục tiêu hơn.`;
    }

    return 'Lịch hôm nay khá thoải mái. Đây là thời điểm tốt để chuẩn bị trước cho những mục tiêu sắp tới.';
  };

  const completionMessage = value => {
    if (value >= 80) {
      return 'Hiệu suất rất tốt! Bạn đang duy trì một nhịp làm việc ổn định.';
    }

    if (value >= 50) {
      return 'Bạn đã đi được hơn nửa chặng đường. Hãy tiếp tục giữ nhịp.';
    }

    return 'Bắt đầu từ công việc nhỏ nhất để tạo đà hoàn thành.';
  };

  const todayItem = task => {
    const taskId = Utils.escapeHTML(task.id);
    const iconName = task.status === 'done' ? 'checkCircle' : 'circle';
    const timeClass = Utils.isOverdue(task) ? 'overdue' : '';
    const deadlineText = Utils.escapeHTML(Utils.relativeDate(task.deadline));
    const priorityText = Utils.escapeHTML(
        StatisticsService.getPriorityLabel(task.priority)
    );

    return `
      <div class="today-item" data-task-id="${taskId}">
        <button
          class="task-check"
          type="button"
          data-action="toggle"
          aria-label="Đổi trạng thái hoàn thành"
        >
          ${Icons.render(iconName, 21)}
        </button>
        <div class="today-main">
          <h3>${Utils.escapeHTML(task.title)}</h3>
          <p>${Utils.escapeHTML(task.description)}</p>
        </div>
        <div class="today-time ${timeClass}">
          <strong>${deadlineText}</strong>
          <small>${priorityText}</small>
        </div>
      </div>
    `;
  };

  const upcomingItem = task => {
    const taskId = Utils.escapeHTML(task.id);
    const deadline = Utils.escapeHTML(Utils.formatDate(task.deadline, true));
    const relativeDeadline = Utils.escapeHTML(Utils.relativeDate(task.deadline));

    return `
      <div class="today-item" data-task-id="${taskId}">
        <span class="stat-icon dashboard-upcoming-icon">
          ${Icons.render('calendar', 17)}
        </span>
        <div class="today-main">
          <h3>${Utils.escapeHTML(task.title)}</h3>
          <p>${UI.categoryBadge(task.categoryId)}</p>
        </div>
        <div class="today-time">
          <strong>${deadline}</strong>
          <small>${relativeDeadline}</small>
        </div>
      </div>
    `;
  };

  const activityIcon = type => {
    const safeType = String(type || '');

    if (safeType.includes('delete')) {
      return 'trash';
    }

    if (safeType.includes('done')) {
      return 'checkCircle';
    }

    if (safeType.includes('backup')) {
      return 'backup';
    }

    if (safeType.includes('category')) {
      return 'category';
    }

    return 'activity';
  };

  const activityItem = item => {
    const text = Utils.escapeHTML(item.text);
    const createdAt = Utils.escapeHTML(Utils.formatDateTime(item.createdAt));

    return `
      <div class="activity-item">
        <span class="activity-dot">
          ${Icons.render(activityIcon(item.type), 16)}
        </span>
        <div>
          <p>${text}</p>
          <time>${createdAt}</time>
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

  const renderHero = (user, stats) => {
    const weekday = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long'
    }).format(new Date());
    const currentDate = Utils.formatDate(Utils.todayISO());

    setText('#dashboardDate', `${weekday} · ${currentDate}`);
    setText(
      '#dashboardWelcomeTitle',
      `${greeting()}, ${AuthService.firstName(user)}! Bắt đầu bằng một việc quan trọng.`
    );
    setText('#dashboardHeroMessage', heroMessage(stats));
  };

  const renderStatistics = stats => {
    setText('#totalTaskCount', stats.total);
    setText('#totalTaskTrend', `${stats.completion}% hoàn thành`);
    setText('#completedTaskCount', stats.done);
    setText(
      '#completedTaskTrend',
      stats.done ? 'Tiếp tục phát huy' : 'Bắt đầu ngay hôm nay'
    );
    setText('#todayTaskCount', stats.today);
    setText(
      '#todayTaskTrend',
      stats.today ? 'Cần ưu tiên' : 'Lịch hôm nay trống'
    );
    setText('#overdueTaskCount', stats.overdue);
    setText(
      '#overdueTaskTrend',
      stats.overdue ? 'Hãy lên kế hoạch lại' : 'Không có việc trễ'
    );
  };

  const renderList = ({
    items,
    containerSelector,
    emptySelector,
    itemRenderer
  }) => {
    const container = document.querySelector(containerSelector);
    const emptyState = document.querySelector(emptySelector);
    const hasItems = items.length > 0;

    if (container) {
      container.hidden = !hasItems;
      container.innerHTML = hasItems ? items.map(itemRenderer).join('') : '';
    }

    if (emptyState) {
      emptyState.hidden = hasItems;
    }
  };

  const renderCompletion = stats => {
    const ring = document.querySelector('#completionRing');

    ring?.style.setProperty('--progress', stats.completion);
    setText('#completionRate', `${stats.completion}%`);
    setText('#completionMessage', completionMessage(stats.completion));
  };

  const renderWeekProgress = tasks => {
    const container = document.querySelector('#dashboardWeekBars');

    if (!container) {
      return;
    }

    const start = Utils.startOfWeek(new Date());
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const completedTasks = tasks.filter(task => task.completedAt);
    const values = labels.map((label, index) => {
      const date = new Date(start);

      date.setDate(start.getDate() + index);

      const isoDate = Utils.toISODate(date);
      const count = completedTasks.filter(task => {
        return Utils.toISODate(new Date(task.completedAt)) === isoDate;
      }).length;

      return {
        label,
        count
      };
    });
    const maximum = Math.max(...values.map(item => item.count), 1);

    container.innerHTML = values.map(item => {
      const height = Math.max(3, Math.round(item.count / maximum * 150));

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

  const drawStatusChart = tasks => {
    const canvas = document.querySelector('#dashboardStatusChart');
    const legend = document.querySelector('#dashboardStatusLegend');

    if (!canvas || !legend) {
      return;
    }

    const rectangle = canvas.getBoundingClientRect();

    if (!rectangle.width || !rectangle.height) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    canvas.width = rectangle.width * ratio;
    canvas.height = rectangle.height * ratio;
    context.scale(ratio, ratio);

    const values = CONFIG.STATUSES.map(status => {
      return tasks.filter(task => task.status === status.value).length;
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    const centerX = rectangle.width / 2;
    const centerY = rectangle.height / 2 - 4;
    const radius = Math.min(rectangle.width, rectangle.height) * 0.3;
    let angle = -Math.PI / 2;

    if (!total) {
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.lineWidth = Math.max(12, radius * 0.38);
      context.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--border')
        .trim() || '#e5e7eb';
      context.stroke();
    } else {
      values.forEach((value, index) => {
        const segment = value / total * Math.PI * 2;

        context.beginPath();
        context.arc(centerX, centerY, radius, angle, angle + segment);
        context.arc(
          centerX,
          centerY,
          radius * 0.62,
          angle + segment,
          angle,
          true
        );
        context.closePath();
        context.fillStyle = CONFIG.STATUSES[index].color;
        context.fill();
        angle += segment;
      });
    }

    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--text')
      .trim() || '#172033';

    context.fillStyle = textColor;
    context.textAlign = 'center';
    context.font = '700 26px Be Vietnam Pro';
    context.fillText(String(total), centerX, centerY + 5);
    context.font = '500 10px Be Vietnam Pro';
    context.fillText('công việc', centerX, centerY + 24);

    legend.innerHTML = CONFIG.STATUSES.map((status, index) => {
      return `
        <span>
          <i style="background:${status.color}"></i>
          ${Utils.escapeHTML(status.label)} (${values[index]})
        </span>
      `;
    }).join('');
  };

  const render = () => {
    const user = AuthService.getCurrentUser();
    const tasks = TaskService.getTasks();
    const stats = StatisticsService.calculateTaskStats(tasks);
    const todayTasks = getTodayTasks(tasks);
    const upcomingTasks = getUpcomingTasks(tasks);
    const recentTasks = getRecentTasks(tasks);
    const activities = ActivityService.getActivities(6);

    if (!user) {
      return;
    }

    renderHero(user, stats);
    renderStatistics(stats);
    renderList({
      items: todayTasks,
      containerSelector: '#todayList',
      emptySelector: '#todayEmptyState',
      itemRenderer: todayItem
    });
    renderList({
      items: upcomingTasks,
      containerSelector: '#upcomingTaskList',
      emptySelector: '#upcomingEmptyState',
      itemRenderer: upcomingItem
    });
    renderList({
      items: activities,
      containerSelector: '#recentActivityList',
      emptySelector: '#activityEmptyState',
      itemRenderer: activityItem
    });
    renderList({
      items: recentTasks,
      containerSelector: '#recentTaskList',
      emptySelector: '#recentTaskEmptyState',
      itemRenderer: todayItem
    });
    renderCompletion(stats);
    renderWeekProgress(tasks);
    drawStatusChart(tasks);
  };

  const bind = () => {
    document.querySelector('#addTaskDashboard')?.addEventListener('click', () => {
      UI.taskForm();
    });
    document.querySelector('[data-hero-add]')?.addEventListener('click', () => {
      UI.taskForm();
    });
    document.querySelector('#addTodayTaskButton')?.addEventListener('click', () => {
      UI.taskForm();
    });

    UI.bindTaskActions(document.querySelector('#todayList'));
    UI.bindTaskActions(document.querySelector('#upcomingTaskList'));
    UI.bindTaskActions(document.querySelector('#recentTaskList'));
  };

  bind();
  render();
  window.addEventListener('taskflow:data-changed', render);

  let resizeTimer;

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      drawStatusChart(TaskService.getTasks());
    }, 180);
  });
})();

