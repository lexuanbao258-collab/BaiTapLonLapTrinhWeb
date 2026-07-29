'use strict';

const ConfirmDialog = (() => {
  const confirm = ({
    title = 'Xác nhận thao tác',
    message,
    confirmText = 'Xác nhận',
    type = 'danger'
  }) => new Promise(resolve => {
    const modal = document.querySelector('#confirmModal');
    const titleElement = document.querySelector('#confirmModalTitle');
    const messageElement = document.querySelector('#confirmModalMessage');
    const iconElement = document.querySelector('#confirmModalIcon');
    const cancelButton = document.querySelector('#confirmCancelButton');
    const acceptButton = document.querySelector('#confirmAcceptButton');

    if (!modal || !titleElement || !messageElement || !cancelButton || !acceptButton) {
      console.error('Khung #confirmModal trong HTML chưa đầy đủ.');
      resolve(false);
      return;
    }

    let settled = false;
    const cleanup = () => {
      cancelButton.removeEventListener('click', cancel);
      acceptButton.removeEventListener('click', accept);
    };
    const settle = (value, shouldClose = true) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);

      if (shouldClose) {
        Modal.close(modal);
      }
    };
    const cancel = () => settle(false);
    const accept = () => settle(true);
    const safeType = ['danger', 'primary', 'success', 'warning', 'info'].includes(type) ?
      type : 'danger';

    titleElement.textContent = String(title || 'Xác nhận thao tác');
    messageElement.textContent = String(message || '');
    acceptButton.textContent = String(confirmText || 'Xác nhận');
    acceptButton.classList.remove(
      'btn-danger',
      'btn-primary',
      'btn-success',
      'btn-warning',
      'btn-info'
    );
    acceptButton.classList.add(`btn-${safeType}`);

    if (iconElement) {
      iconElement.classList.remove('danger', 'primary', 'success', 'warning', 'info');
      iconElement.classList.add(safeType);
      iconElement.innerHTML = Icons.render(safeType === 'danger' ? 'warning' : 'info', 28);
    }

    cancelButton.addEventListener('click', cancel);
    acceptButton.addEventListener('click', accept);
    Modal.bindFrame(modal, '[data-confirm-modal-close]');
    Modal.showFrame(modal, {
      onClose: () => settle(false, false)
    });
  });

  return { confirm };
})();
