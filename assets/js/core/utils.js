'use strict';

const Utils = (() => {
  const HTML_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  });

  const uid = (prefix = 'id') => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).slice(2, 8);

    return `${prefix}_${timestamp}_${randomPart}`;
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, character => {
    return HTML_ENTITIES[character];
  });

  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const debounce = (callback, delay = 250) => {
    let timer;

    return (...args) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  };

  const todayISO = () => {
    const date = new Date();

    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };

  const toISODate = date => {
    const normalizedDate = new Date(date);

    if (Number.isNaN(normalizedDate.getTime())) {
      return '';
    }

    normalizedDate.setMinutes(
      normalizedDate.getMinutes() - normalizedDate.getTimezoneOffset()
    );

    return normalizedDate.toISOString().slice(0, 10);
  };

  const parseDate = value => value ? new Date(`${value}T00:00:00`) : null;

  const formatDate = (value, options = {}) => {
    if (!value) {
      return 'Chưa đặt';
    }

    const isDateOnly = typeof value === 'string' && value.length === 10;
    const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: options.short ? '2-digit' : 'numeric'
    }).format(date);
  };

  const formatDateTime = value => {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const relativeDate = value => {
    if (!value) {
      return 'Không deadline';
    }

    const target = parseDate(value);
    const today = parseDate(todayISO());
    const days = Math.round((target - today) / 86400000);

    if (days < 0) {
      return `Quá hạn ${Math.abs(days)} ngày`;
    }

    if (days === 0) {
      return 'Hôm nay';
    }

    if (days === 1) {
      return 'Ngày mai';
    }

    if (days <= 7) {
      return `Còn ${days} ngày`;
    }

    return formatDate(value);
  };

  const daysBetween = (firstDate, secondDate) => Math.round(
    (parseDate(secondDate) - parseDate(firstDate)) / 86400000
  );

  const isOverdue = task => Boolean(
    task.status !== 'done' && task.deadline && task.deadline < todayISO()
  );

  const isToday = value => value === todayISO();

  const isThisWeek = value => {
    if (!value) {
      return false;
    }

    const today = parseDate(todayISO());
    const day = today.getDay() || 7;
    const start = new Date(today);

    start.setDate(today.getDate() - day + 1);

    const end = new Date(start);

    end.setDate(start.getDate() + 6);

    const date = parseDate(value);

    return date >= start && date <= end;
  };

  const startOfWeek = (date = new Date()) => {
    const start = new Date(date);
    const day = start.getDay() || 7;

    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day + 1);

    return start;
  };

  const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const isJSONFile = file => {
    if (!file || !/\.json$/i.test(String(file.name || ''))) {
      return false;
    }

    const mimeType = String(file.type || '').toLowerCase();

    return !mimeType || mimeType === 'application/json' || mimeType === 'text/json';
  };

  const readJSONFile = file => new Promise((resolve, reject) => {
    if (!isJSONFile(file)) {
      reject(new Error('Vui lòng chọn tệp sao lưu hợp lệ.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const content = String(reader.result || '').replace(/^\uFEFF/, '');

        resolve(JSON.parse(content));
      } catch (error) {
        reject(new Error('Tệp sao lưu không hợp lệ.'));
      }
    };

    reader.onerror = () => reject(new Error('Không thể đọc file.'));
    reader.onabort = () => reject(new Error('Đã hủy đọc file.'));
    reader.readAsText(file, 'utf-8');
  });

  const plural = (count, word) => `${count} ${word}`;

  return {
    uid,
    escapeHTML,
    normalize,
    debounce,
    todayISO,
    toISODate,
    parseDate,
    formatDate,
    formatDateTime,
    relativeDate,
    daysBetween,
    isOverdue,
    isToday,
    isThisWeek,
    startOfWeek,
    clamp,
    downloadJSON,
    isJSONFile,
    readJSONFile,
    plural
  };
})();
