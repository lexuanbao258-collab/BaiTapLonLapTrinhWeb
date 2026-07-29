'use strict';

const TaskActions = (() => {
  const reportMutationFailure = result => {
    Toast.show(Toast.mutationErrorMessage(result), 'error');
  };

  const bind = (container, onChanged) => {
    if (!container || container.taskFlowTaskActionsBound) {
      return;
    }

    container.taskFlowTaskActionsBound = true;
    container.addEventListener('click', async event => {
      const card = event.target.closest('[data-task-id]');
      const actionElement = event.target.closest('[data-action]');

      if (!card || !actionElement || !container.contains(card)) {
        return;
      }

      const task = TaskService.getTaskById(card.dataset.taskId);

      if (!task) {
        return;
      }

      const action = actionElement.dataset.action;

      if (action === 'toggle') {
        const result = TaskService.toggleTaskStatus(task.id);

        if (!Toast.mutationSucceeded(result)) {
          reportMutationFailure(result);
          return;
        }

        Toast.show(task.status === 'done' ?
          'Đã mở lại công việc.' :
          'Tuyệt vời! Công việc đã hoàn thành.');
        onChanged?.();
        return;
      }

      if (action === 'pin') {
        const result = TaskService.toggleTaskPin(task.id);

        if (!Toast.mutationSucceeded(result)) {
          reportMutationFailure(result);
          return;
        }

        Toast.show(task.pinned ? 'Đã bỏ ghim.' : 'Đã ghim công việc.', 'info');
        onChanged?.();
        return;
      }

      if (action !== 'more') {
        return;
      }

      const menu = TaskCard.openMenu(task, actionElement);

      menu.addEventListener('click', async menuEvent => {
        const menuAction = menuEvent.target.closest('[data-action]')?.dataset.action;

        if (!menuAction) {
          return;
        }

        menu.remove();

        if (actionElement.isConnected) {
          actionElement.focus({ preventScroll: true });
        }

        if (menuAction === 'view') {
          TaskDetail.show(task);
          return;
        }

        if (menuAction === 'edit') {
          TaskForm.open(task);
          return;
        }

        if (menuAction === 'duplicate') {
          const result = TaskService.duplicateTask(task.id);

          if (!Toast.mutationSucceeded(result)) {
            reportMutationFailure(result);
            return;
          }

          Toast.show('Đã nhân bản công việc.');
          onChanged?.();
          return;
        }

        if (menuAction === 'pin') {
          const result = TaskService.toggleTaskPin(task.id);

          if (!Toast.mutationSucceeded(result)) {
            reportMutationFailure(result);
            return;
          }

          onChanged?.();
          return;
        }

        if (menuAction === 'delete') {
          const accepted = await ConfirmDialog.confirm({
            title: 'Xóa công việc?',
            message: `Công việc “${task.title}” sẽ bị xóa và không thể hoàn tác.`,
            confirmText: 'Xóa công việc'
          });

          if (!accepted) {
            return;
          }

          const result = TaskService.deleteTask(task.id);

          if (!Toast.mutationSucceeded(result)) {
            reportMutationFailure(result);
            return;
          }

          Toast.show('Đã xóa công việc.');
          onChanged?.();
        }
      });
    });

    container.addEventListener('dblclick', event => {
      const card = event.target.closest('[data-task-id]');

      if (!card || !container.contains(card) || event.target.closest('button')) {
        return;
      }

      const task = TaskService.getTaskById(card.dataset.taskId);

      if (task) {
        TaskDetail.show(task);
      }
    });
  };

  return { bind };
})();
