'use strict';

const Toast = (() => {
  const STORAGE_ERROR_MESSAGE =
    'Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy hoặc bị chặn.';

  const mutationSucceeded = result => {
    if (result === true) {
      return true;
    }

    if (!result) {
      return false;
    }

    if (typeof result === 'object' && 'ok' in result) {
      return result.ok === true;
    }

    return true;
  };

  const mutationErrorMessage = (result, hasFieldErrors = false) => {
    if (typeof result?.message === 'string' && result.message.trim()) {
      return result.message;
    }

    if (typeof result?.errors?.general === 'string') {
      return result.errors.general;
    }

    return hasFieldErrors ?
      'Vui lòng kiểm tra lại thông tin.' :
      STORAGE_ERROR_MESSAGE;
  };

  const show = (message, type = 'success', duration = 2800) => {
    const container = document.querySelector('#toastRoot') ||
      document.querySelector('.toast-container');

    if (!container) {
      console.error('Không tìm thấy vùng hiển thị thông báo #toastRoot.');
      return null;
    }

    const item = document.createElement('div');
    const icon = type === 'success' ?
      'checkCircle' :
      type === 'error' ? 'warning' : 'info';

    item.className = `toast toast-${type}`;
    item.innerHTML = `
      <span class="toast-icon">${Icons.render(icon, 19)}</span>
      <span>${Utils.escapeHTML(message)}</span>
      <button type="button" class="toast-close" aria-label="Đóng">
        ${Icons.render('close', 16)}
      </button>
    `;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    container.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));

    let closed = false;
    const close = () => {
      if (closed) {
        return;
      }

      closed = true;
      item.classList.remove('show');
      window.setTimeout(() => item.remove(), 220);
    };

    item.querySelector('.toast-close')?.addEventListener('click', close, {
      once: true
    });
    window.setTimeout(close, duration);

    return item;
  };

  return {
    STORAGE_ERROR_MESSAGE,
    mutationSucceeded,
    mutationErrorMessage,
    show
  };
})();
