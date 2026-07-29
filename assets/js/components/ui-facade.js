'use strict';

// Transitional public façade for page scripts. The implementation is split by
// component above; this object keeps page controllers concise without keeping
// a second copy of UI logic.
const UI = Object.freeze({
  mutationSucceeded: Toast.mutationSucceeded,
  mutationErrorMessage: Toast.mutationErrorMessage,
  toast: Toast.show,
  openModal: Modal.open,
  closeModal: Modal.close,
  confirm: ConfirmDialog.confirm,
  statusBadge: TaskCard.statusBadge,
  priorityBadge: TaskCard.priorityBadge,
  categoryBadge: TaskCard.categoryBadge,
  progressBar: TaskCard.progressBar,
  taskCard: TaskCard.render,
  taskRow: TaskCard.renderRow,
  emptyState: TaskCard.emptyState,
  menuForTask: TaskCard.openMenu,
  showFieldErrors: TaskForm.showFieldErrors,
  taskDetail: TaskDetail.show,
  taskForm: TaskForm.open,
  bindTaskActions: TaskActions.bind
});
