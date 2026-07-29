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
  const profileAvatar = document.querySelector('#profileAvatar');
  const avatarControl = document.querySelector('#profileAvatarControl');
  const avatarTrigger = document.querySelector('#profileAvatarTrigger');
  const avatarMenu = document.querySelector('#avatarMenu');
  const avatarFileInput = document.querySelector('#avatarFileInput');
  const chooseAvatarButton = document.querySelector('#chooseAvatarImage');
  const viewAvatarButton = document.querySelector('#viewAvatarImage');
  const deleteAvatarButton = document.querySelector('#deleteAvatarImage');
  const avatarPreviewModal = document.querySelector('#avatarPreviewModal');
  const avatarPreviewImage = document.querySelector('#avatarPreviewImage');
  const saveAvatarButton = document.querySelector('#saveAvatarImage');
  const avatarViewModal = document.querySelector('#avatarViewModal');
  const avatarViewImage = document.querySelector('#avatarViewImage');
  const avatarViewFallback = document.querySelector('#avatarViewFallback');
  const ACCEPTED_AVATAR_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_AVATAR_DIMENSION = 512;

  let selectedColor = CONFIG.DEFAULT_ACCENT;
  let isProfileEditing = false;
  let changePasswordModalTrigger = null;
  let deleteModalTrigger = null;
  let deletePasswordResolver = null;
  let pendingAvatarImage = '';

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

  const updateAvatarMenuState = user => {
    if (!deleteAvatarButton) {
      return;
    }

    deleteAvatarButton.hidden = !String(user?.avatarImage || '').trim();
  };

  const showAvatarFallback = (target, user) => {
    if (!target) {
      return;
    }

    target.classList.remove('has-avatar-image');
    target.style.setProperty('--avatar-color', safeAvatarColor(user?.avatarColor));
    target.textContent = AuthService.initials(user);
  };

  const renderProfileAvatar = user => {
    if (!profileAvatar || !user) {
      return;
    }

    const avatarImage = String(user.avatarImage || '').trim();

    profileAvatar.style.setProperty(
      '--avatar-color',
      safeAvatarColor(user.avatarColor)
    );
    updateAvatarMenuState(user);

    if (!avatarImage) {
      showAvatarFallback(profileAvatar, user);
      return;
    }

    const image = document.createElement('img');

    image.className = 'avatar-image';
    image.src = avatarImage;
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    image.addEventListener('error', () => {
      if (profileAvatar.contains(image)) {
        showAvatarFallback(profileAvatar, user);
      }
    }, {
      once: true
    });

    profileAvatar.classList.add('has-avatar-image');
    profileAvatar.replaceChildren(image);
  };

  const visibleAvatarMenuItems = () => {
    return Array.from(
      avatarMenu?.querySelectorAll('[role="menuitem"]:not([hidden])') || []
    );
  };

  const closeAvatarMenu = (restoreFocus = false) => {
    if (!avatarMenu || avatarMenu.hidden) {
      return;
    }

    avatarMenu.hidden = true;
    avatarTrigger?.setAttribute('aria-expanded', 'false');

    if (restoreFocus) {
      avatarTrigger?.focus({
        preventScroll: true
      });
    }
  };

  const openAvatarMenu = () => {
    if (!avatarMenu || !avatarTrigger) {
      return;
    }

    updateAvatarMenuState(AuthService.getCurrentUser());
    avatarMenu.hidden = false;
    avatarTrigger.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      visibleAvatarMenuItems()[0]?.focus({
        preventScroll: true
      });
    });
  };

  const toggleAvatarMenu = () => {
    if (avatarMenu?.hidden) {
      openAvatarMenu();
    } else {
      closeAvatarMenu(true);
    }
  };

  const readAvatarFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Không thể đọc tệp ảnh đã chọn.'));
        return;
      }

      resolve(reader.result);
    }, {
      once: true
    });
    reader.addEventListener('error', () => {
      reject(new Error('Không thể đọc tệp ảnh đã chọn.'));
    }, {
      once: true
    });
    reader.readAsDataURL(file);
  });

  const loadAvatarImage = source => new Promise((resolve, reject) => {
    const image = new Image();

    image.addEventListener('load', () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('Tệp đã chọn không chứa ảnh hợp lệ.'));
        return;
      }

      resolve(image);
    }, {
      once: true
    });
    image.addEventListener('error', () => {
      reject(new Error('Tệp đã chọn không chứa ảnh hợp lệ.'));
    }, {
      once: true
    });
    image.src = source;
  });

  const encodeAvatarCanvas = canvas => {
    try {
      const webp = canvas.toDataURL('image/webp', 0.82);

      if (webp.startsWith('data:image/webp')) {
        return webp;
      }
    } catch {
      // Trình duyệt cũ có thể không hỗ trợ xuất WebP.
    }

    const jpegCanvas = document.createElement('canvas');
    const context = jpegCanvas.getContext('2d');

    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;

    if (!context) {
      throw new Error('Trình duyệt không thể xử lý ảnh đại diện.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    context.drawImage(canvas, 0, 0);

    return jpegCanvas.toDataURL('image/jpeg', 0.82);
  };

  const processAvatarFile = async file => {
    if (!ACCEPTED_AVATAR_TYPES.has(String(file?.type || '').toLowerCase())) {
      throw new Error('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      throw new Error('Ảnh đại diện không được lớn hơn 5 MB.');
    }

    const source = await readAvatarFile(file);
    const image = await loadAvatarImage(source);
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const targetSize = Math.min(
      MAX_AVATAR_DIMENSION,
      Math.floor(sourceSize)
    );
    const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context || targetSize < 1) {
      throw new Error('Trình duyệt không thể xử lý ảnh đại diện.');
    }

    canvas.width = targetSize;
    canvas.height = targetSize;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      targetSize,
      targetSize
    );

    return encodeAvatarCanvas(canvas);
  };

  const resetAvatarPreview = () => {
    pendingAvatarImage = '';
    avatarPreviewImage?.removeAttribute('src');

    if (saveAvatarButton) {
      saveAvatarButton.disabled = false;
    }
  };

  const openAvatarPreview = avatarImage => {
    pendingAvatarImage = avatarImage;
    avatarPreviewImage.src = avatarImage;
    avatarPreviewModal.taskFlowReset = resetAvatarPreview;
    avatarTrigger.focus({
      preventScroll: true
    });
    Modal.showFrame(avatarPreviewModal);
  };

  const showAvatarViewFallback = user => {
    avatarViewImage.hidden = true;
    avatarViewImage.removeAttribute('src');
    avatarViewFallback.hidden = false;
    avatarViewFallback.textContent = AuthService.initials(user);
    avatarViewFallback.style.setProperty(
      '--avatar-color',
      safeAvatarColor(user?.avatarColor)
    );
  };

  const resetAvatarView = () => {
    avatarViewImage?.removeAttribute('src');

    if (avatarViewImage) {
      avatarViewImage.hidden = true;
    }

    if (avatarViewFallback) {
      avatarViewFallback.hidden = true;
    }
  };

  const openAvatarView = () => {
    const user = AuthService.getCurrentUser();

    if (!user) {
      location.replace('login.html');
      return;
    }

    const avatarImage = String(user.avatarImage || '').trim();

    closeAvatarMenu(false);
    avatarTrigger.focus({
      preventScroll: true
    });

    if (avatarImage) {
      avatarViewFallback.hidden = true;
      avatarViewImage.src = avatarImage;
      avatarViewImage.hidden = false;
    } else {
      showAvatarViewFallback(user);
    }

    avatarViewModal.taskFlowReset = resetAvatarView;
    Modal.showFrame(avatarViewModal);
  };

  const savePendingAvatar = () => {
    if (!pendingAvatarImage || saveAvatarButton.disabled) {
      return;
    }

    saveAvatarButton.disabled = true;

    const result = AuthService.updateProfile({
      avatarImage: pendingAvatarImage
    });

    if (!result.ok) {
      saveAvatarButton.disabled = false;
      UI.toast(UI.mutationErrorMessage(result), 'error');
      return;
    }

    renderProfileAvatar(result.data);
    Modal.close(avatarPreviewModal);
    UI.toast('Đã cập nhật ảnh đại diện.');
  };

  const deleteCurrentAvatar = async () => {
    const user = AuthService.getCurrentUser();

    closeAvatarMenu(false);
    avatarTrigger.focus({
      preventScroll: true
    });

    if (!user?.avatarImage) {
      updateAvatarMenuState(user);
      return;
    }

    const approved = await UI.confirm({
      title: 'Xóa ảnh đại diện?',
      message: 'Ảnh đã tải lên sẽ bị xóa. Hồ sơ của bạn sẽ quay về avatar chữ viết tắt và màu hiện tại.',
      confirmText: 'Xóa ảnh',
      type: 'danger'
    });

    if (!approved) {
      return;
    }

    const result = AuthService.updateProfile({
      avatarImage: ''
    });

    if (!result.ok) {
      UI.toast(UI.mutationErrorMessage(result), 'error');
      return;
    }

    renderProfileAvatar(result.data);
    UI.toast('Đã xóa ảnh đại diện.');
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
    renderProfileAvatar(user);
    setText('#profileDisplayName', AuthService.publicName(user));
    const visibleEmail = AuthService.publicEmail(user);

    setText('#profileDisplayEmail', visibleEmail);
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

  const bindAvatarActions = () => {
    Modal.bindFrame(
      avatarPreviewModal,
      '[data-avatar-preview-close]'
    );
    Modal.bindFrame(
      avatarViewModal,
      '[data-avatar-view-close]'
    );

    avatarTrigger.addEventListener('click', toggleAvatarMenu);
    avatarTrigger.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      event.preventDefault();
      openAvatarMenu();

      if (event.key === 'ArrowUp') {
        requestAnimationFrame(() => {
          const items = visibleAvatarMenuItems();

          items[items.length - 1]?.focus({
            preventScroll: true
          });
        });
      }
    });

    avatarMenu.addEventListener('keydown', event => {
      const items = visibleAvatarMenuItems();
      const currentIndex = items.indexOf(document.activeElement);
      let nextIndex = -1;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeAvatarMenu(true);
        return;
      }

      if (event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % items.length;
      } else if (event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = items.length - 1;
      }

      if (nextIndex >= 0) {
        event.preventDefault();
        items[nextIndex]?.focus({
          preventScroll: true
        });
      }
    });

    chooseAvatarButton.addEventListener('click', () => {
      closeAvatarMenu(false);
      avatarTrigger.focus({
        preventScroll: true
      });
      avatarFileInput.click();
    });

    avatarFileInput.addEventListener('change', async () => {
      const file = avatarFileInput.files?.[0];

      avatarFileInput.value = '';

      if (!file) {
        return;
      }

      avatarFileInput.disabled = true;

      try {
        const avatarImage = await processAvatarFile(file);

        openAvatarPreview(avatarImage);
      } catch (error) {
        UI.toast(
          error instanceof Error ?
            error.message :
            'Không thể xử lý ảnh đại diện đã chọn.',
          'error'
        );
      } finally {
        avatarFileInput.disabled = false;
      }
    });

    viewAvatarButton.addEventListener('click', openAvatarView);
    deleteAvatarButton.addEventListener('click', deleteCurrentAvatar);
    saveAvatarButton.addEventListener('click', savePendingAvatar);
    avatarViewImage.addEventListener('error', () => {
      const user = AuthService.getCurrentUser();

      if (user && !avatarViewModal.hidden) {
        showAvatarViewFallback(user);
      }
    });

    document.addEventListener('pointerdown', event => {
      if (
        !avatarMenu.hidden &&
        event.target instanceof Node &&
        !avatarControl.contains(event.target)
      ) {
        closeAvatarMenu(false);
      }
    });
    avatarControl.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!avatarControl.contains(document.activeElement)) {
          closeAvatarMenu(false);
        }
      });
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
        bio: profileForm.elements.bio.value,
        avatarColor: selectedColor,
        avatarImage: AuthService.getCurrentUser()?.avatarImage || ''
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
    !openChangePasswordButton || !profileAvatar || !avatarControl ||
    !avatarTrigger || !avatarMenu || !avatarFileInput || !chooseAvatarButton ||
    !viewAvatarButton || !deleteAvatarButton || !avatarPreviewModal ||
    !avatarPreviewImage || !saveAvatarButton || !avatarViewModal ||
    !avatarViewImage || !avatarViewFallback) {
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
  bindAvatarActions();
  bindActions();

  window.addEventListener('taskflow:profile-updated', event => {
    const user = event.detail?.user || AuthService.getCurrentUser();

    if (user) {
      renderProfileAvatar(user);
    }
  });

  window.addEventListener('taskflow:data-changed', () => {
    const stats = StatisticsService.calculateTaskStats();

    setText(
      '#profileTaskProgress',
      stats.done + '/' + stats.total +
        ' việc đã hoàn thành · ' + stats.completion + '%'
    );
  });
})();
