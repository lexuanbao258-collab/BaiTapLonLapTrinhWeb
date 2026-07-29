'use strict';

const StatisticsService = (() => {
  const getStatusLabel = status => {
    return CONFIG.STATUSES.find(item => item.value === status)?.label || status;
  };

  const getPriorityLabel = priority => {
    return CONFIG.PRIORITIES.find(item => item.value === priority)?.label || priority;
  };

  const calculateTaskStats = tasksArg => {
    const tasks = Array.isArray(tasksArg) ? tasksArg : TaskService.getTasks();
    const total = tasks.length;
    const done = tasks.filter(task => task.status === 'done').length;

    return {
      total,
      done,
      pending: total - done,
      todo: tasks.filter(task => task.status === 'todo').length,
      progress: tasks.filter(task => task.status === 'progress').length,
      overdue: tasks.filter(Utils.isOverdue).length,
      today: tasks.filter(task => {
        return task.status !== 'done' && Utils.isToday(task.deadline);
      }).length,
      high: tasks.filter(task => {
        return task.status !== 'done' && task.priority === 'high';
      }).length,
      pinned: tasks.filter(task => task.pinned).length,
      completion: total ? Math.round(done / total * 100) : 0
    };
  };

  return {
    calculateTaskStats,
    getStatusLabel,
    getPriorityLabel
  };
})();
