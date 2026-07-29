'use strict';

const Modal = (() => {
  let activeModal = null;

  const focusableSelector = [
    '[autofocus]',
    'input:not([type="hidden"]):not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    'button:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const resolveModalTrigger = () => {
    const focused = document.activeElement;

    if (!(focused instanceof HTMLElement)) {
      return null;
    }

    const sourceModal = focused.closest('.modal-overlay');

    return sourceModal?.taskFlowTrigger || focused;
  };

  const focusContent = overlay => {
    if (!overlay || overlay.hidden || overlay.contains(document.activeElement)) {
      return;
    }

    const input = overlay.querySelector(
      '[autofocus], input:not([type="hidden"]):not([disabled]), ' +
      'textarea:not([disabled]), select:not([disabled])'
    );
    const target = input || overlay.querySelector(focusableSelector);

    target?.focus({ preventScroll: true });
  };

  const handleEscape = event => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const bindFrame = (overlay, closeSelector = '') => {
    if (!overlay || overlay.taskFlowFrameBound) {
      return;
    }

    overlay.taskFlowFrameBound = true;

    if (closeSelector) {
      overlay.querySelectorAll(closeSelector).forEach(button => {
        button.addEventListener('click', () => close(overlay));
      });
    }

    overlay.addEventListener('mousedown', event => {
      const clickedBackdrop = event.target === overlay ||
        event.target.closest?.('[data-modal-backdrop]');

      if (clickedBackdrop) {
        close(overlay);
      }
    });
  };

  const showFrame = (overlay, { onOpen, onClose } = {}) => {
    if (!overlay) {
      console.error('Không tìm thấy khung modal trong HTML.');
      return null;
    }

    const trigger = resolveModalTrigger();

    if (activeModal && activeModal !== overlay) {
      close(activeModal, { immediate: true, restoreFocus: false });
    }

    if (overlay.taskFlowCloseTimer) {
      clearTimeout(overlay.taskFlowCloseTimer);
      overlay.taskFlowCloseTimer = null;
    }

    overlay.taskFlowTrigger = trigger;
    overlay.taskFlowOnClose = onClose;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    activeModal = overlay;
    document.addEventListener('keydown', handleEscape);

    const activate = () => {
      if (activeModal !== overlay) {
        return;
      }

      overlay.classList.add('visible');
      focusContent(overlay);
    };

    requestAnimationFrame(activate);
    overlay.taskFlowOpenTimer = window.setTimeout(activate, 60);

    if (typeof onOpen === 'function') {
      onOpen(overlay);
    }

    return overlay;
  };

  const close = (overlay = activeModal, options = {}) => {
    if (!overlay) {
      return;
    }

    const { immediate = false, restoreFocus = true } = options;

    if (overlay.taskFlowCloseTimer) {
      if (!immediate) {
        return;
      }

      clearTimeout(overlay.taskFlowCloseTimer);
      overlay.taskFlowCloseTimer = null;
    }

    if (overlay.taskFlowOpenTimer) {
      clearTimeout(overlay.taskFlowOpenTimer);
      overlay.taskFlowOpenTimer = null;
    }

    const wasActive = overlay === activeModal;

    if (wasActive) {
      activeModal = null;
      document.removeEventListener('keydown', handleEscape);
    }

    overlay.classList.remove('visible');

    if (!activeModal) {
      document.body.classList.remove('modal-open');
    }

    const onClose = overlay.taskFlowOnClose;
    const trigger = overlay.taskFlowTrigger;

    overlay.taskFlowOnClose = null;

    if (typeof onClose === 'function') {
      onClose(overlay);
    }

    const finish = () => {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.taskFlowCloseTimer = null;

      if (typeof overlay.taskFlowReset === 'function') {
        overlay.taskFlowReset(overlay);
      }

      if (
        restoreFocus &&
        !activeModal &&
        trigger instanceof HTMLElement &&
        trigger.isConnected
      ) {
        trigger.focus({ preventScroll: true });
      }

      overlay.taskFlowTrigger = null;
    };

    if (immediate) {
      finish();
      return;
    }

    overlay.taskFlowCloseTimer = window.setTimeout(finish, 180);
  };

  const setRegionContent = (region, content) => {
    if (!region) {
      return;
    }

    if (content instanceof Node) {
      region.replaceChildren(content);
      return;
    }

    region.textContent = String(content || '');
  };

  const open = ({ title, content, size = 'md', footer = '', onOpen, onClose }) => {
    const overlay = document.querySelector('#genericModal');
    const dialog = document.querySelector('#genericModalDialog');
    const titleElement = document.querySelector('#genericModalTitle');
    const body = document.querySelector('#genericModalBody');
    const footerElement = document.querySelector('#genericModalFooter');

    if (!overlay || !dialog || !titleElement || !body || !footerElement) {
      console.error('Khung #genericModal trong HTML chưa đầy đủ.');
      return null;
    }

    const safeSize = ['sm', 'md', 'lg', 'xl'].includes(size) ? size : 'md';

    ['modal-sm', 'modal-md', 'modal-lg', 'modal-xl'].forEach(className => {
      dialog.classList.remove(className);
    });
    dialog.classList.add(`modal-${safeSize}`);
    titleElement.textContent = String(title || CONFIG.APP_NAME);
    setRegionContent(body, content);
    setRegionContent(footerElement, footer);
    footerElement.hidden = !footer;

    overlay.taskFlowReset = () => {
      titleElement.textContent = '';
      body.replaceChildren();
      footerElement.replaceChildren();
      footerElement.hidden = true;
    };

    bindFrame(overlay, '[data-generic-modal-close]');
    return showFrame(overlay, { onOpen, onClose });
  };

  return {
    bindFrame,
    showFrame,
    close,
    open
  };
})();
