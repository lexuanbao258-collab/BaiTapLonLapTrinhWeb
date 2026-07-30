'use strict';

const App = (() => {
  const defaultAccent = CONFIG.DEFAULT_ACCENT;
  const requestedPage = document.body.dataset.page || 'dashboard';

  const isValidHexColor = value => {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());
  };

  const safeHexColor = (value, fallback = defaultAccent) => {
    return isValidHexColor(value) ? String(value).trim() : fallback;
  };

  const hexToRgbString = hex => {
    const candidate = String(hex || '')
      .trim()
      .replace('#', '');
    const normalized = /^[0-9a-fA-F]{6}$/.test(candidate) ?
      candidate :
      defaultAccent.slice(1);
    const value = Number.parseInt(normalized, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;

    return `${red}, ${green}, ${blue}`;
  };

  const applyAccentColor = accent => {
    const safeAccent = safeHexColor(accent);
    const accentRgb = hexToRgbString(safeAccent);

    document.documentElement.style.setProperty('--accent', safeAccent);
    document.documentElement.style.setProperty('--accent-rgb', accentRgb);
    document.body.style.setProperty('--accent', safeAccent);
    document.body.style.setProperty('--accent-rgb', accentRgb);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      safeAccent
    );
  };

  const authenticatedUser = AuthService.getCurrentUser();

  if (!authenticatedUser) {
    const current = [
      location.pathname.split('/').pop() || 'index.html',
      location.search || ''
    ].join('');

    location.replace(`login.html?redirect=${encodeURIComponent(current)}`);

    return {
      page: 'auth-redirect',
      content: () => null,
      applySettings: () => {},
      applyAccentColor: () => {},
      renderIcons: () => {},
      updateNavCounts: () => {}
    };
  }

  const sessionUserIdAtLoad = authenticatedUser.id;
  const page = requestedPage;

  const renderIcons = (root = document) => {
    root.querySelectorAll('[data-icon]').forEach(slot => {
      const size = Number(slot.dataset.iconSize) || 20;
      const className = slot.dataset.iconClass || '';

      slot.innerHTML = Icons.render(slot.dataset.icon, size, className);
    });
  };

  const renderIconSlot = (slot, iconName, size = 20) => {
    if (!slot) {
      return;
    }

    slot.dataset.icon = iconName;
    slot.dataset.iconSize = String(size);
    slot.innerHTML = Icons.render(iconName, size);
  };

  const applySettings = () => {
    const settings = SettingsService.getSettings();
    const layout = document.querySelector('#appLayout');

    document.documentElement.dataset.theme = settings.theme || 'light';
    document.documentElement.classList.toggle(
      'compact-mode',
      Boolean(settings.compact)
    );
    layout?.classList.toggle(
      'sidebar-collapsed',
      Boolean(settings.sidebarCollapsed)
    );
    applyAccentColor(settings.accent);
    renderIconSlot(
      document.querySelector('#themeIcon'),
      settings.theme === 'dark' ? 'sun' : 'moon',
      20
    );
  };

  const updateActiveNavigation = () => {
    document.querySelectorAll('.sidebar-nav [data-page]').forEach(link => {
      const active = link.dataset.page === page;

      link.classList.toggle('active', active);

      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const settingsLink = document.querySelector('[data-settings-link]');

    settingsLink?.classList.toggle('active', page === 'about');

    if (page === 'about') {
      settingsLink?.setAttribute('aria-current', 'page');
    } else {
      settingsLink?.removeAttribute('aria-current');
    }
  };

  const renderUserAvatar = (node, user, initials) => {
    const avatarImage = String(user.avatarImage || '').trim();

    node.style.setProperty('--avatar-color', safeHexColor(user.avatarColor));

    if (!avatarImage) {
      node.classList.remove('has-avatar-image');
      node.textContent = initials;
      return;
    }

    const currentImage = node.querySelector(':scope > img.avatar-image');

    if (currentImage?.getAttribute('src') === avatarImage) {
      currentImage.alt = '';
      currentImage.draggable = false;
      currentImage.setAttribute('aria-hidden', 'true');
      node.classList.add('has-avatar-image');
      return;
    }

    const image = document.createElement('img');

    image.className = 'avatar-image';
    image.src = avatarImage;
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    image.addEventListener('error', () => {
      if (!node.contains(image)) {
        return;
      }

      node.classList.remove('has-avatar-image');
      node.textContent = initials;
    }, {
      once: true
    });

    node.classList.add('has-avatar-image');
    node.replaceChildren(image);
  };

  const updateUserInfo = () => {
    const user = AuthService.getCurrentUser();

    if (!user) {
      location.replace('login.html');
      return;
    }

    const initials = AuthService.initials(user);

    document.querySelectorAll('[data-current-user-initials]').forEach(node => {
      renderUserAvatar(node, user, initials);
    });
    document.querySelectorAll('[data-current-user-name]').forEach(node => {
      node.textContent = AuthService.publicName(user);
    });
    document.querySelectorAll('[data-current-user-email]').forEach(node => {
      node.textContent = AuthService.publicEmail(user);
    });
  };

  const updateFocusCard = statsArg => {
    const stats = statsArg || StatisticsService.calculateTaskStats();
    const element = document.querySelector('[data-focus-text]');

    if (!element) {
      return;
    }

    if (stats.today) {
      element.textContent = `${stats.today} việc cần làm hôm nay.`;
      return;
    }

    if (stats.overdue) {
      element.textContent = `${stats.overdue} việc đang quá hạn.`;
      return;
    }

    element.textContent = 'Bạn đang kiểm soát tốt tiến độ.';
  };

  const updateNavCounts = tasks => {
    const stats = StatisticsService.calculateTaskStats(tasks);
    const pending = document.querySelector('[data-count="pending"]');
    const today = document.querySelector('[data-count="today"]');

    if (pending) {
      pending.textContent = stats.pending || '';
    }

    if (today) {
      today.textContent = stats.today || '';
    }

    updateFocusCard(stats);
  };

  const getReminderTasks = tasks => {
    const taskList = Array.isArray(tasks) ? tasks : TaskService.getTasks();

    return taskList
      .filter(task => {
        return Utils.isOverdue(task) ||
          (task.status !== 'done' && Utils.isToday(task.deadline));
      })
      .sort((first, second) => {
        return String(first.deadline || '').localeCompare(
          String(second.deadline || '')
        );
      });
  };

  const notificationItem = task => {
    const taskId = Utils.escapeHTML(String(task.id || ''));
    const deadlineText = Utils.escapeHTML(Utils.relativeDate(task.deadline));
    const priorityText = Utils.escapeHTML(
      StatisticsService.getPriorityLabel(task.priority)
    );
    const dotType = Utils.isOverdue(task) ? 'danger' : 'warning';

    return `
      <button type="button" data-notification-task="${taskId}">
        <span class="notification-dot ${dotType}"></span>
        <span>
          <strong>${Utils.escapeHTML(task.title)}</strong>
          <small>${deadlineText} · ${priorityText}</small>
        </span>
      </button>
    `;
  };

  const updateNotificationCount = tasks => {
    const count = getReminderTasks(tasks).length;
    const badge = document.querySelector('[data-notification-count]');

    if (!badge) {
      return;
    }

    badge.textContent = count || '';
    badge.classList.toggle('visible', count > 0);
  };

  const updateSharedTaskIndicators = () => {
    const tasks = TaskService.getTasks();

    updateNavCounts(tasks);
    updateNotificationCount(tasks);
  };

  const positionPopover = (popover, trigger) => {
    const rect = trigger.getBoundingClientRect();

    popover.style.top = `${rect.bottom + 10}px`;
    popover.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
  };

  const hidePopover = (popover, trigger) => {
    if (!popover) {
      return;
    }

    popover.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  };

  const closeAllPopovers = except => {
    document.querySelectorAll('.popover[id]').forEach(popover => {
      if (popover !== except) {
        const controls = popover.id;
        const trigger = document.querySelector(`[aria-controls="${controls}"]`);

        hidePopover(popover, trigger);
      }
    });
  };

  const togglePopover = (popover, trigger) => {
    if (!popover || !trigger) {
      return false;
    }

    const shouldOpen = popover.hidden;

    closeAllPopovers(shouldOpen ? popover : null);
    popover.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));

    if (shouldOpen) {
      positionPopover(popover, trigger);
    }

    return shouldOpen;
  };

  const showNotifications = () => {
    const button = document.querySelector('#notificationBtn');
    const popover = document.querySelector('#notificationPopover');
    const list = document.querySelector('#notificationList');

    if (!button || !popover || !list) {
      return;
    }

    const tasks = getReminderTasks();

    list.innerHTML = tasks.length ?
      tasks.slice(0, 6).map(notificationItem).join('') :
      `
        <div class="popover-empty">
          ${Icons.render('checkCircle', 32)}
          <p>Không có cảnh báo mới.</p>
        </div>
      `;

    togglePopover(popover, button);
  };

  const showProfileMenu = () => {
    const button = document.querySelector('#profileChip');
    const popover = document.querySelector('#profilePopover');

    updateUserInfo();
    togglePopover(popover, button);
  };

  const closeSidebar = ({ restoreFocus = false } = {}) => {
    const sidebar = document.querySelector('#sidebar');
    const backdrop = document.querySelector('#sidebarBackdrop');
    const menuButton = document.querySelector('#mobileMenu');
    const wasOpen = Boolean(sidebar?.classList.contains('open'));

    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Mở menu');
    document.body.classList.remove('sidebar-open');

    if (restoreFocus && wasOpen) {
      menuButton?.focus({
        preventScroll: true
      });
    }
  };

  const bindSidebar = () => {
    const layout = document.querySelector('#appLayout');
    const sidebar = document.querySelector('#sidebar');
    const backdrop = document.querySelector('#sidebarBackdrop');
    const collapseButton = document.querySelector('#sidebarCollapse');
    const menuButton = document.querySelector('#mobileMenu');
    const mobileQuery = window.matchMedia('(max-width: 760px)');

    collapseButton?.addEventListener('click', () => {
      const wasCollapsed = layout.classList.contains('sidebar-collapsed');

      layout.classList.toggle('sidebar-collapsed');

      const result = SettingsService.saveSettings({
        sidebarCollapsed: layout.classList.contains('sidebar-collapsed')
      });

      if (!UI.mutationSucceeded(result)) {
        layout.classList.toggle('sidebar-collapsed', wasCollapsed);
        UI.toast(UI.mutationErrorMessage(result), 'error');
      }
    });

    menuButton?.addEventListener('click', () => {
      const shouldOpen = !sidebar.classList.contains('open');

      sidebar.classList.toggle('open', shouldOpen);
      backdrop?.classList.toggle('show', shouldOpen);
      menuButton.setAttribute('aria-expanded', String(shouldOpen));
      menuButton.setAttribute(
        'aria-label',
        shouldOpen ? 'Đóng menu' : 'Mở menu'
      );
      document.body.classList.toggle('sidebar-open', shouldOpen);
    });

    backdrop?.addEventListener('click', () => closeSidebar());
    sidebar?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => closeSidebar());
    });

    const handleViewportChange = event => {
      if (!event.matches) {
        closeSidebar();
      }
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleViewportChange);
    } else {
      mobileQuery.addListener(handleViewportChange);
    }
  };

  const toggleTheme = () => {
    const current = SettingsService.getSettings().theme || 'light';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    const result = SettingsService.saveSettings({
      theme: nextTheme
    });

    if (!UI.mutationSucceeded(result)) {
      UI.toast(UI.mutationErrorMessage(result), 'error');
      return;
    }

    applySettings();
    UI.toast(
      `Đã chuyển sang giao diện ${nextTheme === 'dark' ? 'tối' : 'sáng'}.`,
      'info'
    );
  };

  const bindSearch = () => {
    const search = document.querySelector('#globalSearch');
    const container = document.querySelector('[data-global-search]');
    const toggleButton = document.querySelector('#globalSearchToggle');
    const closeButton = document.querySelector('#globalSearchClose');
    const mobileQuery = window.matchMedia('(max-width: 760px)');

    if (!search || !container || !toggleButton || !closeButton) {
      return;
    }

    const openMobileSearch = () => {
      if (!mobileQuery.matches) {
        search.focus({
          preventScroll: true
        });
        return;
      }

      container.classList.add('mobile-open');
      toggleButton.setAttribute('aria-expanded', 'true');
      toggleButton.setAttribute('aria-label', 'Thu gọn tìm kiếm');
      closeButton.hidden = false;
      search.focus({
        preventScroll: true
      });
    };

    const closeMobileSearch = (restoreFocus = false) => {
      if (!container.classList.contains('mobile-open')) {
        return;
      }

      container.classList.remove('mobile-open');
      toggleButton.setAttribute('aria-expanded', 'false');
      toggleButton.setAttribute('aria-label', 'Mở tìm kiếm');
      closeButton.hidden = true;

      if (restoreFocus) {
        toggleButton.focus({
          preventScroll: true
        });
      }
    };

    const syncSearchMode = () => {
      if (mobileQuery.matches) {
        toggleButton.setAttribute(
          'aria-label',
          container.classList.contains('mobile-open') ?
            'Thu gọn tìm kiếm' :
            'Mở tìm kiếm'
        );
        toggleButton.setAttribute(
          'aria-expanded',
          String(container.classList.contains('mobile-open'))
        );
        closeButton.hidden = !container.classList.contains('mobile-open');
        return;
      }

      container.classList.remove('mobile-open');
      toggleButton.removeAttribute('aria-expanded');
      toggleButton.setAttribute('aria-label', 'Tập trung vào ô tìm kiếm');
      closeButton.hidden = true;
    };

    toggleButton.addEventListener('click', event => {
      event.preventDefault();

      if (!mobileQuery.matches) {
        search.focus({
          preventScroll: true
        });
        return;
      }

      if (container.classList.contains('mobile-open')) {
        closeMobileSearch(true);
      } else {
        openMobileSearch();
      }
    });

    closeButton.addEventListener('click', event => {
      event.preventDefault();
      closeMobileSearch(true);
    });

    search.addEventListener('keydown', event => {
      if (event.key === 'Enter' && search.value.trim()) {
        location.href = `tasks.html?q=${encodeURIComponent(search.value.trim())}`;
      }
    });

    document.addEventListener('pointerdown', event => {
      if (
        mobileQuery.matches &&
        container.classList.contains('mobile-open') &&
        !container.contains(event.target) &&
        !search.value.trim()
      ) {
        closeMobileSearch(false);
      }
    });

    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        container.classList.contains('mobile-open')
      ) {
        event.preventDefault();
        closeMobileSearch(true);
      }
    });

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncSearchMode);
    } else {
      mobileQuery.addListener(syncSearchMode);
    }

    syncSearchMode();
  };

  const bindStaticPopovers = () => {
    const notificationButton = document.querySelector('#notificationBtn');
    const notificationPopover = document.querySelector('#notificationPopover');
    const notificationList = document.querySelector('#notificationList');
    const profileButton = document.querySelector('#profileChip');
    const profilePopover = document.querySelector('#profilePopover');

    notificationButton?.addEventListener('click', showNotifications);
    profileButton?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showProfileMenu();
    });

    notificationList?.addEventListener('click', event => {
      const id = event.target
        .closest('[data-notification-task]')
        ?.dataset.notificationTask;

      if (!id) {
        return;
      }

      hidePopover(notificationPopover, notificationButton);
      notificationButton.focus({
        preventScroll: true
      });

      const task = TaskService.getTaskById(id);

      if (task) {
        UI.taskDetail(task);
      }
    });

    document.querySelector('#quickBackupButton')?.addEventListener('click', () => {
      const result = BackupService.createBackup();

      if (!UI.mutationSucceeded(result)) {
        UI.toast(UI.mutationErrorMessage(result), 'error');
        return;
      }

      hidePopover(profilePopover, profileButton);
      UI.toast('Đã tạo bản sao lưu nhanh.');
    });

    document.querySelector('#quickAddTaskButton')?.addEventListener('click', () => {
      hidePopover(profilePopover, profileButton);
      profileButton?.focus({
        preventScroll: true
      });
      UI.taskForm();
    });

    document.querySelector('#logoutButton')?.addEventListener('click', () => {
      const loggedOut = AuthService.logout();

      if (!loggedOut) {
        UI.toast(UI.mutationErrorMessage(null), 'error');
        return;
      }

      location.replace('login.html?loggedOut=1');
    });

    document.addEventListener('click', event => {
      if (
        notificationPopover &&
        !notificationPopover.hidden &&
        !notificationPopover.contains(event.target) &&
        !notificationButton?.contains(event.target)
      ) {
        hidePopover(notificationPopover, notificationButton);
      }

      if (
        profilePopover &&
        !profilePopover.hidden &&
        !profilePopover.contains(event.target) &&
        !profileButton?.contains(event.target)
      ) {
        hidePopover(profilePopover, profileButton);
      }
    });
  };

  const bindKeyboardShortcuts = () => {
    document.addEventListener('keydown', event => {
      const search = document.querySelector('#globalSearch');

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const searchContainer = search?.closest('[data-global-search]');
        const searchToggle = document.querySelector('#globalSearchToggle');

        if (
          window.matchMedia('(max-width: 760px)').matches &&
          searchContainer &&
          !searchContainer.classList.contains('mobile-open')
        ) {
          searchToggle?.click();
        }

        search?.focus();
        search?.select();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        UI.taskForm();
      }

      if (event.key === 'Escape') {
        const sidebar = document.querySelector('#sidebar');
        const notificationButton = document.querySelector('#notificationBtn');
        const notificationPopover = document.querySelector('#notificationPopover');
        const profileButton = document.querySelector('#profileChip');
        const profilePopover = document.querySelector('#profilePopover');
        const shouldRestoreSidebarFocus = Boolean(
          sidebar?.classList.contains('open')
        );
        const shouldRestoreProfileFocus = Boolean(
          profilePopover && !profilePopover.hidden
        );
        const shouldRestoreNotificationFocus = Boolean(
          notificationPopover && !notificationPopover.hidden
        );

        closeSidebar({
          restoreFocus: shouldRestoreSidebarFocus
        });
        closeAllPopovers();

        if (shouldRestoreProfileFocus) {
          profileButton?.focus({
            preventScroll: true
          });
        } else if (shouldRestoreNotificationFocus) {
          notificationButton?.focus({
            preventScroll: true
          });
        }
      }
    });
  };

  const prefetchedRoutes = new Set();

  const prefetchAppRoute = href => {
    try {
      const url = new URL(href, location.href);

      if (
        url.origin !== location.origin ||
        !url.pathname.endsWith('.html') ||
        (url.pathname === location.pathname && url.search === location.search)
      ) {
        return;
      }

      const route = url.href;

      if (prefetchedRoutes.has(route)) {
        return;
      }

      prefetchedRoutes.add(route);

      const hint = document.createElement('link');

      hint.rel = 'prefetch';
      hint.as = 'document';
      hint.href = route;
      hint.addEventListener('error', () => {
        prefetchedRoutes.delete(route);
      }, {
        once: true
      });
      document.head.append(hint);
    } catch {
      // Invalid or unsupported links should keep their normal navigation flow.
    }
  };

  const bindNavigationPrefetch = () => {
    document.querySelectorAll(
      '.sidebar-nav a[href], .sidebar-bottom a[href], .brand-link[href]'
    ).forEach(link => {
      const prefetch = () => prefetchAppRoute(link.href);

      link.addEventListener('pointerenter', prefetch, {
        once: true,
        passive: true
      });
      link.addEventListener('focus', prefetch, {
        once: true
      });
      link.addEventListener('touchstart', prefetch, {
        once: true,
        passive: true
      });
    });
  };

  const bindGlobalEvents = () => {
    bindSidebar();
    bindSearch();
    bindStaticPopovers();
    bindKeyboardShortcuts();
    bindNavigationPrefetch();
    document.querySelector('#themeToggle')?.addEventListener('click', toggleTheme);
  };

  const serviceWorkerUpdateKey = `taskflow-service-worker-update-${CONFIG.VERSION}`;

  const shouldCheckForServiceWorkerUpdate = () => {
    try {
      if (sessionStorage.getItem(serviceWorkerUpdateKey) === '1') {
        return false;
      }

      sessionStorage.setItem(serviceWorkerUpdateKey, '1');
      return true;
    } catch {
      return true;
    }
  };

  const retryServiceWorkerUpdateLater = () => {
    try {
      sessionStorage.removeItem(serviceWorkerUpdateKey);
    } catch {
      // Session storage may be unavailable in restrictive browser contexts.
    }
  };

  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('./service-worker.js')
        .then(registration => {
          if (!shouldCheckForServiceWorkerUpdate()) {
            return null;
          }

          return registration.update().catch(() => {
            retryServiceWorkerUpdateLater();
          });
        })
        .catch(() => {});
    }
  };

  const scheduleNonCriticalStartup = () => {
    window.setTimeout(() => {
      updateSharedTaskIndicators();
      registerServiceWorker();
    }, 0);
  };

  const init = () => {
    const currentUser = AuthService.getCurrentUser();
    const legacyMigration = Storage.migrateLegacyDataToActiveUser();
    const legacyCleanup = legacyMigration.ok && !legacyMigration.requiresRecovery ?
      Storage.cleanupLegacyData() : legacyMigration;
    const isDemoUser = AuthService.isExperienceAccount(currentUser);
    const workspaceReady = isDemoUser ?
      WorkspaceService.seedDemoData() :
      WorkspaceService.ensureUserWorkspace();

    if (!legacyMigration.ok || legacyMigration.requiresRecovery || !legacyCleanup.ok) {
      console.warn('Không thể dọn dữ liệu TaskFlow bản cũ an toàn.', legacyCleanup.error);
    }

    applySettings();
    renderIcons();
    updateActiveNavigation();
    updateUserInfo();
    bindGlobalEvents();
    scheduleNonCriticalStartup();

    if (!workspaceReady) {
      UI.toast(UI.mutationErrorMessage(null), 'error', 4800);
    }

    window.addEventListener('taskflow:data-changed', () => {
      updateSharedTaskIndicators();
    });
    window.addEventListener('taskflow:profile-updated', updateUserInfo);

    window.addEventListener('pageshow', () => {
      const activeUser = AuthService.getCurrentUser();

      if (!activeUser) {
        location.replace('login.html');
        return;
      }

      // A page restored from back/forward cache must never render the previous
      // account after another account has started a new session.
      if (activeUser.id !== sessionUserIdAtLoad) {
        location.replace(location.href);
        return;
      }

      updateUserInfo();
    });

    window.addEventListener('storage', event => {
      if (event.key !== CONFIG.STORAGE.SESSION) {
        return;
      }

      const activeUser = AuthService.getCurrentUser();

      if (!activeUser) {
        location.replace('login.html');
        return;
      }

      if (activeUser.id !== sessionUserIdAtLoad) {
        location.replace(location.href);
      }
    });
  };

  const content = () => document.querySelector('#pageContent');

  init();

  return {
    page,
    content,
    applySettings,
    applyAccentColor,
    renderIcons,
    updateNavCounts,
    updateUserInfo
  };
})();
