'use strict';

(() => {
  if (App.page !== 'profile') {
    return;
  }

  const profileForm = document.querySelector('#profileForm');
  const passwordForm = document.querySelector('#passwordForm');
  const avatarColors = document.querySelector('#avatarColors');
  const editProfileButton = document.querySelector('#editProfile');
  const profileFormActions = document.querySelector('#profileFormActions');
  const cancelProfileEditButton = document.querySelector('#cancelProfileEdit');
  const changePasswordModal = document.querySelector('#changePasswordModal');
  const openChangePasswordButton = document.querySelector('#openChangePassword');
  const deleteModal = document.querySelector('#deleteAccountModal');
  const deletePasswordInput = document.querySelector('#deletePasswordInput');
  const deletePasswordError = document.querySelector('#deletePasswordError');
  const deletePasswordConfirm = document.querySelector('#deletePasswordConfirm');

  let selectedColor = CONFIG.DEFAULT_ACCENT;
  let isProfileEditing = false;
  let changePasswordModalTrigger = null;
  let deleteModalTrigger = null;
  let deletePasswordResolver = null;

  const safeAvatarColor = color => {
    return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ?
      String(color) :
      CONFIG.DEFAULT_ACCENT;
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);

    if (element) {
      element.textContent = String(value ?? '');
    }
  };

  const updateAvatarChoices = () => {
    document.querySelectorAll('[data-avatar-color]').forEach(button => {
      const color = safeAvatarColor(button.dataset.avatarColor);
      const active = color.toLowerCase() === selectedColor.toLowerCase();

      button.style.setProperty('--choice', color);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.title = color;
    });

    document.querySelector('#profileAvatar')?.style.setProperty(
      '--avatar-color',
      selectedColor
    );
  };

  const fillProfile = () => {
    const user = AuthService.getCurrentUser();

    if (!user) {
      location.replace('login.html');
      return false;
    }

    const stats = StatisticsService.calculateTaskStats();

    selectedColor = safeAvatarColor(user.avatarColor);
    setText('#profileAvatar', AuthService.initials(user));
    setText('#profileDisplayName', AuthService.publicName(user));
    setText('#profileDisplayRole', user.role || 'Người dùng TaskFlow');
    const visibleEmail = AuthService.publicEmail(user);

    setText('#profileDisplayEmail', visibleEmail);
    setText('#profileDisplaySchool', user.school || 'Chưa cập nhật');
    setText(
      '#profileJoinDate',
      Utils.formatDate(user.createdAt?.slice(0, 10) || Utils.todayISO())
    );
    setText(
      '#profileTaskProgress',
      stats.done + '/' + stats.total +
        ' việc đã hoàn thành · ' + stats.completion + '%'
    );

    profileForm.elements.fullName.value = AuthService.publicName(user);
    profileForm.elements.email.value = visibleEmail;
    profileForm.elements.role.value = user.role || '';
    profileForm.elements.school.value = user.school || '';
    profileForm.elements.bio.value = AuthService.publicBio(user);

    updateAvatarChoices();

    return true;
  };

  const clearErrors = (form, attribute) => {
    form.querySelectorAll('[' + attribute + ']').forEach(node => {
      node.textContent = '';
    });
    form.querySelectorAll('.invalid').forEach(node => {
      node.classList.remove('invalid');
      node.removeAttribute('aria-invalid');
    });
  };

  const setProfileEditMode = editable => {
    isProfileEditing = Boolean(editable);
    profileForm.setAttribute('aria-readonly', String(!isProfileEditing));

    profileForm.querySelectorAll('input, textarea').forEach(field => {
      field.readOnly = !isProfileEditing;
      field.setAttribute('aria-readonly', String(!isProfileEditing));
    });

    avatarColors.querySelectorAll('[data-avatar-color]').forEach(button => {
      button.disabled = !isProfileEditing;
    });

    editProfileButton.hidden = isProfileEditing;
    profileFormActions.hidden = !isProfileEditing;

    if (!isProfileEditing) {
      clearErrors(profileForm, 'data-profile-error');
    }
  };

  const startProfileEdit = () => {
    if (isProfileEditing) {
      return;
    }

    fillProfile();
    setProfileEditMode(true);
    profileForm.elements.fullName.focus();
  };

  const cancelProfileEdit = () => {
    if (!isProfileEditing) {
      return;
    }

    fillProfile();
    setProfileEditMode(false);
  };

  const showErrors = (form, errors, attribute) => {
    Object.entries(errors || {}).forEach(([key, message]) => {
      const target = form.querySelector(
        '[' + attribute + '="' + key + '"]'
      );
      const input = form.elements.namedItem(key);

      if (target) {
        target.textContent = message;
      }

      if (input?.classList) {
        input.classList.add('invalid');
        input.setAttribute('aria-invalid', 'true');
      }
    });

    form.querySelector('.invalid')?.focus();
  };

  const finishSubmit = (form, button) => {
    delete form.dataset.submitting;
    button.disabled = false;
  };

  const resetPasswordForm = () => {
    passwordForm.reset();
    clearErrors(passwordForm, 'data-password-error');
    delete passwordForm.dataset.submitting;

    const submitButton = passwordForm.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = false;
    }
  };

  function handleChangePasswordModalKeydown(event) {
    if (event.key === 'Escape') {
      closeChangePasswordModal();
    }
  }

  function closeChangePasswordModal() {
    if (!changePasswordModal || changePasswordModal.hidden) {
      return;
    }

    const trigger = changePasswordModalTrigger;

    changePasswordModalTrigger = null;
    resetPasswordForm();
    changePasswordModal.classList.remove('visible');
    changePasswordModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleChangePasswordModalKeydown);

    window.setTimeout(() => {
      changePasswordModal.hidden = true;

      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({
          preventScroll: true
        });
      }
    }, 180);
  }

  const openChangePasswordModal = () => {
    if (!changePasswordModal || changePasswordModal.hidden === false) {
      return;
    }

    changePasswordModalTrigger = document.activeElement;
    resetPasswordForm();
    changePasswordModal.hidden = false;
    changePasswordModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleChangePasswordModalKeydown);

    requestAnimationFrame(() => {
      changePasswordModal.classList.add('visible');
      passwordForm.elements.oldPassword.value = '';
      passwordForm.elements.oldPassword.focus();
    });

    window.setTimeout(() => {
      if (!changePasswordModal.hidden) {
        passwordForm.elements.oldPassword.value = '';
      }
    }, 100);
  };

  const bindChangePasswordModal = () => {
    openChangePasswordButton.addEventListener('click', openChangePasswordModal);

    changePasswordModal.querySelectorAll('[data-change-password-close]').forEach(button => {
      button.addEventListener('click', closeChangePasswordModal);
    });

    changePasswordModal.addEventListener('mousedown', event => {
      if (event.target === changePasswordModal) {
        closeChangePasswordModal();
      }
    });
  };

  function handleDeleteModalKeydown(event) {
    if (event.key === 'Escape') {
      closeDeletePasswordModal(null);
    }

    if (event.key === 'Enter' && document.activeElement === deletePasswordInput) {
      event.preventDefault();
      deletePasswordConfirm.click();
    }
  }

  function closeDeletePasswordModal(value) {
    if (!deleteModal || deleteModal.hidden) {
      return;
    }

    deleteModal.classList.remove('visible');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleDeleteModalKeydown);

    const resolver = deletePasswordResolver;
    const trigger = deleteModalTrigger;

    deletePasswordResolver = null;
    deleteModalTrigger = null;

    window.setTimeout(() => {
      deleteModal.hidden = true;
      deleteModal.setAttribute('aria-hidden', 'true');
      deletePasswordInput.value = '';
      deletePasswordInput.classList.remove('invalid');
      deletePasswordInput.removeAttribute('aria-invalid');
      deletePasswordError.textContent = '';

      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({
          preventScroll: true
        });
      }
    }, 180);

    resolver?.(value);
  }

  const requestDeletePassword = () => new Promise(resolve => {
    if (!deleteModal || !deletePasswordInput || !deletePasswordConfirm) {
      resolve(null);
      return;
    }

    deleteModalTrigger = document.activeElement;
    deletePasswordResolver = resolve;
    deletePasswordInput.value = '';
    deletePasswordError.textContent = '';
    deleteModal.hidden = false;
    deleteModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleDeleteModalKeydown);

    requestAnimationFrame(() => {
      deleteModal.classList.add('visible');
      deletePasswordInput.focus();
    });
  });

  const bindDeleteModal = () => {
    deleteModal?.querySelectorAll('[data-delete-password-close]').forEach(button => {
      button.addEventListener('click', () => {
        closeDeletePasswordModal(null);
      });
    });

    deleteModal?.addEventListener('mousedown', event => {
      if (event.target === deleteModal) {
        closeDeletePasswordModal(null);
      }
    });

    deletePasswordInput?.addEventListener('input', () => {
      deletePasswordInput.classList.remove('invalid');
      deletePasswordInput.removeAttribute('aria-invalid');
      deletePasswordError.textContent = '';
    });

    deletePasswordConfirm?.addEventListener('click', () => {
      const password = deletePasswordInput.value;

      if (!password) {
        deletePasswordInput.classList.add('invalid');
        deletePasswordInput.setAttribute('aria-invalid', 'true');
        deletePasswordError.textContent = 'Vui lòng nhập mật khẩu.';
        deletePasswordInput.focus();
        return;
      }

      closeDeletePasswordModal(password);
    });
  };

  const bindProfileForm = () => {
    editProfileButton.addEventListener('click', startProfileEdit);
    cancelProfileEditButton.addEventListener('click', cancelProfileEdit);

    profileForm.addEventListener('submit', event => {
      event.preventDefault();

      if (!isProfileEditing || profileForm.dataset.submitting === '1') {
        return;
      }

      profileForm.dataset.submitting = '1';

      const submitButton = profileForm.querySelector('[type="submit"]');

      submitButton.disabled = true;
      clearErrors(profileForm, 'data-profile-error');

      const result = AuthService.updateProfile({
        fullName: profileForm.elements.fullName.value,
        email: profileForm.elements.email.value,
        role: profileForm.elements.role.value,
        school: profileForm.elements.school.value,
        bio: profileForm.elements.bio.value,
        avatarColor: selectedColor
      });

      if (!result.ok) {
        showErrors(profileForm, result.errors, 'data-profile-error');

        const hasFieldErrors = Object.keys(result.errors || {}).some(name => {
          return Boolean(profileForm.elements.namedItem(name));
        });

        UI.toast(
          UI.mutationErrorMessage(result, hasFieldErrors),
          'error'
        );
        finishSubmit(profileForm, submitButton);
        return;
      }

      finishSubmit(profileForm, submitButton);
      fillProfile();
      setProfileEditMode(false);
      UI.toast('Đã cập nhật hồ sơ cá nhân.');
    });
  };

  const bindPasswordForm = () => {
    passwordForm.addEventListener('submit', event => {
      event.preventDefault();

      if (changePasswordModal.hidden || passwordForm.dataset.submitting === '1') {
        return;
      }

      passwordForm.dataset.submitting = '1';

      const submitButton = passwordForm.querySelector('[type="submit"]');

      submitButton.disabled = true;
      clearErrors(passwordForm, 'data-password-error');

      const result = AuthService.changePassword({
        oldPassword: passwordForm.elements.oldPassword.value,
        newPassword: passwordForm.elements.newPassword.value,
        confirmPassword: passwordForm.elements.confirmPassword.value
      });

      if (!result.ok) {
        showErrors(passwordForm, result.errors, 'data-password-error');

        const hasFieldErrors = Object.keys(result.errors || {}).some(name => {
          return Boolean(passwordForm.elements.namedItem(name));
        });

        UI.toast(
          UI.mutationErrorMessage(result, hasFieldErrors),
          'error'
        );
        finishSubmit(passwordForm, submitButton);
        return;
      }

      finishSubmit(passwordForm, submitButton);
      closeChangePasswordModal();
      UI.toast('Đổi mật khẩu thành công.');
    });
  };

  const bindActions = () => {
    avatarColors.addEventListener('click', event => {
      if (!isProfileEditing) {
        return;
      }

      const button = event.target.closest('[data-avatar-color]');

      if (!button) {
        return;
      }

      selectedColor = safeAvatarColor(button.dataset.avatarColor);
      updateAvatarChoices();
    });

    document.querySelector('#logoutProfile').addEventListener('click', () => {
      const loggedOut = AuthService.logout();

      if (!loggedOut) {
        UI.toast(UI.mutationErrorMessage(null), 'error');
        return;
      }

      location.replace('login.html?loggedOut=1');
    });

    document.querySelector('#deleteAccount').addEventListener('click', async () => {
      const approved = await UI.confirm({
        title: 'Xóa tài khoản này?',
        message: 'Toàn bộ dữ liệu công việc của tài khoản sẽ bị xóa vĩnh viễn. Hãy tạo bản sao lưu trong Cài đặt & dữ liệu trước nếu bạn muốn lưu lại.',
        confirmText: 'Tiếp tục xóa'
      });

      if (!approved) {
        return;
      }

      await new Promise(resolve => {
        window.setTimeout(resolve, 200);
      });

      const password = await requestDeletePassword();

      if (password === null) {
        return;
      }

      const result = AuthService.deleteAccount(password);

      if (!result.ok) {
        UI.toast(UI.mutationErrorMessage(result), 'error');
        return;
      }

      location.replace('register.html');
    });
  };

  if (!profileForm || !passwordForm || !avatarColors || !editProfileButton ||
    !profileFormActions || !cancelProfileEditButton || !changePasswordModal ||
    !openChangePasswordButton) {
    console.error('Trang hồ sơ thiếu các phần tử HTML bắt buộc.');
    return;
  }

  if (!fillProfile()) {
    return;
  }

  setProfileEditMode(false);
  bindProfileForm();
  bindPasswordForm();
  bindChangePasswordModal();
  bindDeleteModal();
  bindActions();

  window.addEventListener('taskflow:data-changed', () => {
    const stats = StatisticsService.calculateTaskStats();

    setText(
      '#profileTaskProgress',
      stats.done + '/' + stats.total +
        ' việc đã hoàn thành · ' + stats.completion + '%'
    );
  });
})();
