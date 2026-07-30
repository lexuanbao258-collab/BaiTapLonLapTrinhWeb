'use strict';
(() => {
  const page = document.body.dataset.authPage;

  if (!['login', 'register', 'forgot'].includes(page)) {
    return;
  }

  const params = new URLSearchParams(location.search);

  const safeRedirect = () => {
    const value = params.get('redirect') || 'index.html';

    return /^[a-z0-9_-]+\.html(?:\?[^#]*)?$/i.test(value) ? value : 'index.html';
  };

  if (AuthService.isAuthenticated()) {
    location.replace(safeRedirect());
    return;
  }

  const renderIcons = () => {
    document.querySelectorAll('[data-auth-icon]').forEach(node => {
      node.innerHTML = Icons.render(node.dataset.authIcon, 18);
    });
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
      button.innerHTML = Icons.render('eye', 18);

      if (!button.hasAttribute('aria-label')) {
        button.setAttribute('aria-label', 'Hiện mật khẩu');
      }
    });
    document.querySelectorAll('.auth-modal-close').forEach(button => {
      button.innerHTML = Icons.render('close', 19);
    });
    document.querySelectorAll('.demo-arrow').forEach(node => {
      node.innerHTML = Icons.render('arrowRight', 18);
    });
  };
  const clearErrors = (form, selector = '[data-error]') => {
    form.querySelectorAll(selector).forEach(node => {
      node.textContent = '';
    });

    form.querySelectorAll('.invalid').forEach(node => node.classList.remove('invalid'));
  };

  const showErrors = (form, errors, prefix = '') => {
    Object.entries(errors || {}).forEach(([field, message]) => {
      const attr = prefix ? `[data-${prefix}-error="${field}"]` : `[data-error="${field}"]`;
      const target = form.querySelector(attr);

      if (target) {
        target.textContent = message;
      }

      const input = form.elements[field];

      if (input?.classList) {
        input.classList.add('invalid');
      }
    });

    const first = form.querySelector('.invalid');

    first?.focus();
  };

  const setLoading = (form, active) => {
    const button = form.querySelector('[type="submit"]');

    if (!button) {
      return;
    }

    button.disabled = active;
    button.classList.toggle('loading', active);
  };

  const beginSubmit = form => {
    if (form.dataset.submitting === 'true') {
      return false;
    }

    form.dataset.submitting = 'true';
    setLoading(form, true);

    return true;
  };

  const finishSubmit = form => {
    delete form.dataset.submitting;
    setLoading(form, false);
  };

  const notice = (message, tone = 'success') => {
    const target = document.querySelector('#authNotice');

    if (!target) {
      return;
    }

    target.hidden = false;
    target.className = `auth-notice ${tone}`;
    target.innerHTML =
      `${Icons.render(tone === 'success' ? 'checkCircle' : 'info', 18)}<span>${Utils.escapeHTML(message)}</span>`;
  };

  const bindPasswordToggles = () => {
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.querySelector(`#${button.dataset.togglePassword}`);

        if (!input) {
          return;
        }

        const visible = input.type === 'text';

        input.type = visible ? 'password' : 'text';
        button.classList.toggle('visible', !visible);
        button.innerHTML = Icons.render(visible ? 'eye' : 'x', 18);
        button.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
      });
    });
  };
  const initLogin = () => {
    const form = document.querySelector('#loginForm');
    const email = document.querySelector('#loginEmail');

    email.value = AuthService.lastEmail() || '';

    if (params.get('registered') === '1') {
      notice('Đăng ký thành công. Hãy đăng nhập bằng tài khoản vừa tạo.');
    }

    if (params.get('loggedOut') === '1') {
      notice('Bạn đã đăng xuất an toàn.', 'info');
    }

    if (params.get('reset') === '1') {
      notice('Mật khẩu đã được cập nhật. Hãy đăng nhập lại.');
    }

    const registerLink = document.querySelector('#registerLink');

    registerLink.href = `register.html?redirect=${encodeURIComponent(safeRedirect())}`;

    form.addEventListener('submit', event => {
      event.preventDefault();

      if (!beginSubmit(form)) {
        return;
      }

      clearErrors(form);

      const result = AuthService.login({
        email: form.email.value,
        password: form.password.value,
        remember: form.remember.checked
      });

      window.setTimeout(() => {
        if (!result.ok) {
          finishSubmit(form);
          showErrors(form, result.errors);
          return;
        }

        document.body.classList.add('auth-leaving');
        window.setTimeout(() => location.replace(safeRedirect()), 180);
      }, 320);
    });

    document.querySelector('#demoLogin').addEventListener('click', () => {
      email.value = AuthService.getExperienceEmail();
      form.password.value = '123456';
      form.remember.checked = true;
      email.dispatchEvent(new Event('input'));
      form.password.dispatchEvent(new Event('input'));
      form.requestSubmit();
    });

    const modal = document.querySelector('#forgotModal');
    const forgotForm = document.querySelector('#forgotForm');
    const forgotTrigger = document.querySelector('#openForgot');
    let forgotCloseTimer = null;

    const openModal = () => {
      if (forgotCloseTimer) {
        clearTimeout(forgotCloseTimer);
        forgotCloseTimer = null;
      }

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      forgotTrigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('modal-open');
      document.querySelector('#forgotEmail').value = email.value;
      const activateModal = () => {
        if (modal.hidden) {
          return;
        }

        modal.classList.add('visible');
        document.querySelector('#forgotEmail').focus();
      };

      requestAnimationFrame(activateModal);
      window.setTimeout(activateModal, 60);
    };

    const closeModal = (restoreFocus = true) => {
      if (modal.hidden) {
        return;
      }

      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
      forgotTrigger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('modal-open');
      clearErrors(forgotForm, '[data-forgot-error]');

      forgotCloseTimer = window.setTimeout(() => {
        modal.hidden = true;
        forgotCloseTimer = null;

        if (
          restoreFocus &&
          forgotTrigger instanceof HTMLElement &&
          forgotTrigger.isConnected
        ) {
          forgotTrigger.focus({
            preventScroll: true
          });
        }
      }, 220);
    };

    forgotTrigger.addEventListener('click', openModal);
    document.querySelector('#closeForgot').addEventListener('click', closeModal);

    modal.addEventListener('click', event => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('visible')) {
        closeModal();
      }
    });

    forgotForm.addEventListener('submit', event => {
      event.preventDefault();

      if (!beginSubmit(forgotForm)) {
        return;
      }

      clearErrors(forgotForm, '[data-forgot-error]');

      const result = AuthService.resetPassword({
        email: forgotForm.email.value,
        newPassword: forgotForm.newPassword.value,
        confirmPassword: forgotForm.confirmPassword.value
      });

      if (!result.ok) {
        finishSubmit(forgotForm);
        showErrors(forgotForm, result.errors, 'forgot');
        return;
      }

      closeModal(false);
      email.value = forgotForm.email.value.trim().toLowerCase();
      form.password.value = '';
      notice('Đã đặt lại mật khẩu. Bạn có thể đăng nhập ngay.');
      form.password.focus();
      forgotForm.reset();

      window.setTimeout(() => finishSubmit(forgotForm), 300);
    });
  };
  const passwordStrength = value => {
    let score = 0;

    if (value.length >= 6) {
      score += 1;
    }

    if (value.length >= 10) {
      score += 1;
    }

    if (/[A-ZÀ-Ỹ]/.test(value) && /[a-zà-ỹ]/.test(value)) {
      score += 1;
    }

    if (/\d/.test(value) && /[^\w\sÀ-ỹ]/.test(value)) {
      score += 1;
    }

    return score;
  };

  const updateStrength = value => {
    const box = document.querySelector('#passwordStrength');

    if (!box) {
      return;
    }

    const score = passwordStrength(value);
    const labels = ['Độ mạnh mật khẩu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'];

    box.dataset.score = String(score);
    box.querySelectorAll('i').forEach((item, index) => {
      item.classList.toggle('active', index < score);
    });
    box.querySelector('span').textContent = labels[score];
  };

  const initRegister = () => {
    const form = document.querySelector('#registerForm');
    const password = document.querySelector('#registerPassword');
    const loginLink = document.querySelector('#loginLink');

    loginLink.href = `login.html?redirect=${encodeURIComponent(safeRedirect())}`;
    password.addEventListener('input', () => updateStrength(password.value));

    form.addEventListener('submit', event => {
      event.preventDefault();

      if (!beginSubmit(form)) {
        return;
      }

      clearErrors(form);

      const result = AuthService.register({
        fullName: form.fullName.value,
        email: form.email.value,
        password: form.password.value,
        confirmPassword: form.confirmPassword.value,
        acceptTerms: form.acceptTerms.checked
      });

      window.setTimeout(() => {
        if (!result.ok) {
          finishSubmit(form);
          showErrors(form, result.errors);
          return;
        }

        document.body.classList.add('auth-leaving');
        const target =
          `login.html?registered=1&redirect=${encodeURIComponent(safeRedirect())}`;

        window.setTimeout(() => location.replace(target), 180);
      }, 350);
    });
  };

  const initForgotPassword = () => {
    const form = document.querySelector('#forgotPageForm');
    const email = document.querySelector('#forgotPageEmail');
    const loginLink = document.querySelector('#forgotLoginLink');

    if (!form || !email || !loginLink) {
      console.error('Trang quên mật khẩu thiếu các phần tử HTML bắt buộc.');
      return;
    }

    email.value = AuthService.lastEmail() || '';
    loginLink.href =
      `login.html?redirect=${encodeURIComponent(safeRedirect())}`;

    form.addEventListener('submit', event => {
      event.preventDefault();

      if (!beginSubmit(form)) {
        return;
      }

      clearErrors(form);

      const result = AuthService.resetPassword({
        email: form.email.value,
        newPassword: form.newPassword.value,
        confirmPassword: form.confirmPassword.value
      });

      window.setTimeout(() => {
        if (!result.ok) {
          finishSubmit(form);
          showErrors(form, result.errors);
          return;
        }

        document.body.classList.add('auth-leaving');

        const target =
          `login.html?reset=1&redirect=${encodeURIComponent(safeRedirect())}`;

        window.setTimeout(() => location.replace(target), 180);
      }, 320);
    });
  };
  const bindRealtimeCleanup = () => {
    document.querySelectorAll('.auth-form input').forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('invalid');
        const form = input.closest('form');
        const target = form?.querySelector(`[data-error="${input.name}"]`) || form
          ?.querySelector(`[data-forgot-error="${input.name}"]`);

        if (target) {
          target.textContent = '';
        }

        form?.querySelector(
          '[data-error="general"], [data-forgot-error="general"]'
        )?.replaceChildren();
      });
    });
  };

  renderIcons();
  bindPasswordToggles();
  bindRealtimeCleanup();

  if (page === 'login') {
    initLogin();
  }

  if (page === 'register') {
    initRegister();
  }

  if (page === 'forgot') {
    initForgotPassword();
  }
})();
