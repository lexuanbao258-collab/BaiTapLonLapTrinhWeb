'use strict';

(() => {
  if (App.page !== 'categories') {
    return;
  }

  let editingCategory = null;
  let selectedIcon = '📁';
  let previousFocus = null;
  let contextTrigger = null;

  const safeColor = color => {
    return /^#[0-9a-fA-F]{6}$/.test(color || '') ?
      color :
      CONFIG.DEFAULT_CATEGORY_COLOR;
  };

  const categoryCard = (category, tasks) => {
    const related = tasks.filter(task => task.categoryId === category.id);
    const done = related.filter(task => task.status === 'done').length;
    const overdue = related.filter(Utils.isOverdue).length;
    const completion = related.length ?
      Math.round(done / related.length * 100) :
      0;
    const color = safeColor(category.color);

    return `
      <article
        class="category-card"
        data-category-id="${Utils.escapeHTML(category.id)}"
        style="--category-color:${color}"
        tabindex="0"
        role="link"
        aria-label="Xem công việc thuộc danh mục ${Utils.escapeHTML(category.name)}"
      >
        <div class="category-head">
          <span class="category-icon">${Utils.escapeHTML(category.icon)}</span>
          <button
            class="icon-btn"
            type="button"
            data-action="more"
            aria-label="Mở tác vụ cho ${Utils.escapeHTML(category.name)}"
          >
            ${Icons.render('more', 18)}
          </button>
        </div>
        <h3>${Utils.escapeHTML(category.name)}</h3>
        <p>
          ${related.length
            ? `${completion}% công việc đã hoàn thành`
            : 'Chưa có công việc trong danh mục'}
        </p>
        <div class="category-stats">
          <div><strong>${related.length}</strong><small>Tổng</small></div>
          <div><strong>${done}</strong><small>Hoàn thành</small></div>
          <div><strong>${overdue}</strong><small>Quá hạn</small></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-track">
            <span style="width:${completion}%;background:${color}"></span>
          </div>
        </div>
      </article>
    `;
  };

  const render = () => {
    const categories = CategoryService.getAll();
    const tasks = TaskService.getTasks();
    const grid = document.querySelector('#categoryGrid');
    const emptyState = document.querySelector('#categoryEmptyState');
    const hasCategories = categories.length > 0;

    grid.hidden = !hasCategories;
    grid.innerHTML = hasCategories ?
      categories.map(category => categoryCard(category, tasks)).join('') :
      '';
    emptyState.hidden = hasCategories;
  };

  const showCategoryModal = () => {
    const modal = document.querySelector('#categoryModal');

    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.classList.add('visible'));
    window.setTimeout(() => document.querySelector('#categoryName').focus(), 80);
  };

  const closeCategoryModal = () => {
    const modal = document.querySelector('#categoryModal');

    if (modal.hidden) {
      return;
    }

    modal.classList.remove('visible');
    document.body.classList.remove('modal-open');
    window.setTimeout(() => {
      modal.hidden = true;
      previousFocus?.focus();
      previousFocus = null;
    }, 180);
  };

  const selectEmoji = icon => {
    selectedIcon = icon;
    document.querySelectorAll('#categoryEmojiPicker [data-emoji]').forEach(button => {
      button.classList.toggle('active', button.dataset.emoji === icon);
    });
  };

  const openCategoryForm = (category = null) => {
    const form = document.querySelector('#categoryForm');
    const color = safeColor(category?.color || CONFIG.CATEGORY_COLORS[0]);

    editingCategory = category;
    selectedIcon = category?.icon || '📁';
    form.reset();
    form.elements.name.value = category?.name || '';
    form.elements.color.value = color;
    UI.showFieldErrors(form, {});
    selectEmoji(selectedIcon);
    document.querySelector('#categoryModalTitle').textContent = category ?
      'Chỉnh sửa danh mục' :
      'Thêm danh mục';
    document.querySelector('[data-save-category-label]').textContent = category ?
      'Lưu thay đổi' :
      'Tạo danh mục';
    showCategoryModal();
  };

  const closeContextMenu = () => {
    const menu = document.querySelector('#categoryContextMenu');

    menu.hidden = true;
    delete menu.dataset.categoryId;
    contextTrigger = null;
  };

  const openContextMenu = (categoryId, trigger) => {
    const menu = document.querySelector('#categoryContextMenu');
    const rect = trigger.getBoundingClientRect();

    contextTrigger = trigger;
    menu.dataset.categoryId = categoryId;
    menu.hidden = false;
    menu.style.left = `${Math.max(12, rect.right - 210)}px`;
    menu.style.top = `${Math.min(
      window.innerHeight - menu.offsetHeight - 12,
      rect.bottom + 6
    )}px`;
  };

  const openCategoryTasks = categoryId => {
    location.href = `tasks.html?category=${encodeURIComponent(categoryId)}`;
  };

  const handleGridClick = event => {
    const card = event.target.closest('[data-category-id]');

    if (!card) {
      return;
    }

    const moreButton = event.target.closest('[data-action="more"]');

    if (moreButton) {
      openContextMenu(card.dataset.categoryId, moreButton);
      return;
    }

    openCategoryTasks(card.dataset.categoryId);
  };

  const handleContextAction = async event => {
    const action = event.target.closest('[data-menu]')?.dataset.menu;
    const menu = document.querySelector('#categoryContextMenu');
    const category = CategoryService.getById(menu.dataset.categoryId);

    if (!action || !category) {
      return;
    }

    const returnTrigger = contextTrigger;

    closeContextMenu();
    returnTrigger?.focus({
      preventScroll: true
    });

    if (action === 'view') {
      openCategoryTasks(category.id);
      return;
    }

    if (action === 'edit') {
      openCategoryForm(category);
      return;
    }

    if (action !== 'delete') {
      return;
    }

    const accepted = await UI.confirm({
      title: 'Xóa danh mục?',
      message: `Các công việc trong “${category.name}” sẽ chuyển về chưa phân loại.`,
      confirmText: 'Xóa danh mục'
    });

    if (!accepted) {
      return;
    }

    const result = CategoryService.remove(category.id);

    if (!UI.mutationSucceeded(result)) {
      UI.toast(UI.mutationErrorMessage(result), 'error');
      return;
    }

    UI.toast('Đã xóa danh mục.');
  };

  const submitCategory = event => {
    event.preventDefault();

    const form = event.currentTarget;
    const saveButton = document.querySelector('#saveCategoryButton');

    if (saveButton.disabled) {
      return;
    }

    saveButton.disabled = true;

    const input = {
      name: form.elements.name.value,
      color: form.elements.color.value,
      icon: selectedIcon
    };
    const result = editingCategory ?
      CategoryService.update(editingCategory.id, input) :
      CategoryService.add(input);

    if (!UI.mutationSucceeded(result)) {
      UI.showFieldErrors(form, result?.errors || {});
      UI.toast(
        UI.mutationErrorMessage(result, !result?.errors?.general),
        'error'
      );
      saveButton.disabled = false;
      return;
    }

    closeCategoryModal();
    UI.toast(
      editingCategory ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.'
    );
    editingCategory = null;
    saveButton.disabled = false;
  };

  const bind = () => {
    document.querySelector('#addCategory').addEventListener('click', () => {
      openCategoryForm();
    });
    document.querySelector('#addFirstCategoryButton').addEventListener('click', () => {
      openCategoryForm();
    });
    document.querySelector('#categoryGrid').addEventListener('click', handleGridClick);
    document.querySelector('#categoryGrid').addEventListener('keydown', event => {
      if (
        event.key === 'Enter' &&
        !event.target.closest('button') &&
        event.target.matches('[data-category-id]')
      ) {
        openCategoryTasks(event.target.dataset.categoryId);
      }
    });
    document.querySelector('#categoryContextMenu').addEventListener(
      'click',
      handleContextAction
    );
    document.querySelector('#categoryEmojiPicker').addEventListener('click', event => {
      const button = event.target.closest('[data-emoji]');

      if (button) {
        selectEmoji(button.dataset.emoji);
      }
    });
    document.querySelector('#categoryForm').addEventListener('submit', submitCategory);
    document.querySelector('#cancelCategoryButton').addEventListener(
      'click',
      closeCategoryModal
    );
    document.querySelector('[data-category-modal-close]').addEventListener(
      'click',
      closeCategoryModal
    );
    document.querySelector('#categoryModal').addEventListener('mousedown', event => {
      if (event.target.id === 'categoryModal') {
        closeCategoryModal();
      }
    });
    document.addEventListener('click', event => {
      const menu = document.querySelector('#categoryContextMenu');

      if (
        !menu.hidden &&
        !menu.contains(event.target) &&
        !contextTrigger?.contains(event.target)
      ) {
        closeContextMenu();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') {
        return;
      }

      closeContextMenu();
      closeCategoryModal();
    });
  };

  bind();
  render();
  window.addEventListener('taskflow:data-changed', render);
})();

