'use strict';

const Validators = (() => {
  const isValidISODate = value => {
    const normalized = String(value || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return false;
    }

    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  };

  // Existing overdue deadlines remain editable. Only a newly entered past
  // deadline is rejected, preserving records imported from older releases.
  const validateDeadline = (data, errors) => {
    const deadline = String(data.deadline || '').trim();

    if (!deadline) {
      errors.deadline = 'Vui lòng chọn hạn hoàn thành.';
      return;
    }

    if (!isValidISODate(deadline)) {
      errors.deadline = 'Deadline không đúng định dạng YYYY-MM-DD.';
      return;
    }

    const today = Utils.todayISO();
    const isCreating = !data.id;
    const originalDeadline = String(data.originalDeadline || '').trim();
    const deadlineChanged = !originalDeadline || deadline !== originalDeadline;

    if (isCreating && deadline < today) {
      errors.deadline = 'Deadline không được nhỏ hơn ngày hiện tại.';
      return;
    }

    if (!isCreating && deadline < today && deadlineChanged) {
      errors.deadline = 'Deadline mới không được nhỏ hơn ngày hiện tại.';
    }
  };

  const task = (data = {}) => {
    const errors = {};
    const title = String(data.title || '').trim();
    const description = String(data.description || '').trim();

    if (!title) {
      errors.title = 'Vui lòng nhập tiêu đề công việc.';
    } else if (title.length < 3) {
      errors.title = 'Tiêu đề cần có ít nhất 3 ký tự.';
    } else if (title.length > 120) {
      errors.title = 'Tiêu đề không vượt quá 120 ký tự.';
    }

    if (!description) {
      errors.description = 'Vui lòng nhập mô tả.';
    } else if (description.length < 10) {
      errors.description = 'Mô tả cần có ít nhất 10 ký tự.';
    } else if (description.length > 1000) {
      errors.description = 'Mô tả không vượt quá 1000 ký tự.';
    }

    validateDeadline(data, errors);

    if (!['low', 'medium', 'high'].includes(data.priority)) {
      errors.priority = 'Mức ưu tiên không hợp lệ.';
    }

    if (!['todo', 'progress', 'done'].includes(data.status)) {
      errors.status = 'Trạng thái không hợp lệ.';
    }

    const hasEstimate = data.estimate !== '' &&
      data.estimate !== null &&
      data.estimate !== undefined;
    const estimate = Number(data.estimate);

    if (hasEstimate && (!Number.isFinite(estimate) || estimate < 0 || estimate > 1000)) {
      errors.estimate = 'Thời gian dự kiến từ 0 đến 1000 giờ.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  };

  const category = (data = {}) => {
    const errors = {};
    const name = String(data.name || '').trim();

    if (!name) {
      errors.name = 'Vui lòng nhập tên danh mục.';
    } else if (name.length < 2) {
      errors.name = 'Tên danh mục cần có ít nhất 2 ký tự.';
    } else if (name.length > 40) {
      errors.name = 'Tên danh mục không vượt quá 40 ký tự.';
    }

    if (!/^#[0-9a-f]{6}$/i.test(data.color || '')) {
      errors.color = 'Màu danh mục không hợp lệ.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  };

  return {
    isValidISODate,
    task,
    category
  };
})();
