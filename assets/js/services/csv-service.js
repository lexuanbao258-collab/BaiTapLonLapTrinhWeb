'use strict';

const CSVService = (() => {
  const CSV_HEADERS = Object.freeze([
    'Title',
    'Description',
    'Deadline',
    'Priority',
    'Status',
    'Category',
    'Labels',
    'Progress',
    'Estimated Hours',
    'Pinned'
  ]);
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const HEADER_KEYS = CSV_HEADERS.map(header => header.toLowerCase());

  const requireActiveUser = () => {
    const userId = Storage.activeUserId();

    if (!userId) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }

    return userId;
  };

  const cleanText = value => String(value ?? '').trim();

  const normalizeHeader = value => cleanText(value)
    .replace(/^\uFEFF/, '')
    .toLowerCase();

  const escapeCell = value => {
    const text = String(value ?? '');

    return /[",\r\n]/.test(text) ?
      `"${text.replace(/"/g, '""')}"` :
      text;
  };

  const categoryNamesById = () => {
    const names = new Map();

    CategoryService.getAll().forEach(category => {
      if (category?.id) {
        names.set(category.id, String(category.name || '').trim());
      }
    });

    return names;
  };

  const taskToCSVRow = (task, categories) => [
    task.title || '',
    task.description || '',
    task.deadline || '',
    task.priority || 'medium',
    task.status || 'todo',
    categories.get(task.categoryId) || '',
    Array.isArray(task.tags) ? task.tags.join('; ') : '',
    Number.isFinite(Number(task.progress)) ? Number(task.progress) : 0,
    Number.isFinite(Number(task.estimate)) ? Number(task.estimate) : 0,
    task.pinned ? 'TRUE' : 'FALSE'
  ];

  const buildTasksCSV = () => {
    requireActiveUser();

    const categories = categoryNamesById();
    const tasks = TaskService.getTasks();
    const lines = [CSV_HEADERS, ...tasks.map(task => taskToCSVRow(task, categories))]
      .map(row => row.map(escapeCell).join(','));

    return {
      csv: `\uFEFF${lines.join('\r\n')}`,
      count: tasks.length
    };
  };

  const exportTasks = () => buildTasksCSV().csv;

  const downloadTasksCSV = () => {
    const exportResult = buildTasksCSV();
    const filename = `taskflow-cong-viec-${Utils.todayISO()}.csv`;
    const blob = new Blob([exportResult.csv], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);

    return {
      filename,
      count: exportResult.count
    };
  };

  const isCSVFile = file => {
    const filename = String(file?.name || '').trim();
    const mimeType = String(file?.type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const allowedTypes = new Set([
      '',
      'text/csv',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel'
    ]);

    return /\.csv$/i.test(filename) && allowedTypes.has(mimeType);
  };

  const readFileAsText = file => {
    if (typeof file?.text === 'function') {
      return file.text();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không thể đọc tệp danh sách.'));
      reader.onabort = () => reject(new Error('Đã hủy đọc tệp danh sách.'));
      reader.readAsText(file, 'utf-8');
    });
  };

  const parseCSVText = source => {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];

      if (quoted) {
        if (character === '"') {
          if (source[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += character;
        }

        continue;
      }

      if (character === '"' && !cell.length) {
        quoted = true;
        continue;
      }

      if (character === ',') {
        row.push(cell);
        cell = '';
        continue;
      }

      if (character === '\n' || character === '\r') {
        if (character === '\r' && source[index + 1] === '\n') {
          index += 1;
        }

        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += character;
    }

    if (quoted) {
      throw new Error('Tệp danh sách có dấu ngoặc kép chưa được đóng.');
    }

    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }

    return rows.filter(cells => cells.some(value => cleanText(value)));
  };

  const validateHeaders = headers => {
    if (!Array.isArray(headers)) {
      return {
        valid: false,
        message: 'Tệp danh sách chưa có hàng tiêu đề.'
      };
    }

    const normalized = headers.map(normalizeHeader);
    const duplicateHeaders = normalized.filter((header, index) => {
      return header && normalized.indexOf(header) !== index;
    });
    const missing = CSV_HEADERS.filter(header => {
      return !normalized.includes(header.toLowerCase());
    });
    const hasExpectedOrder = normalized.length === HEADER_KEYS.length &&
      HEADER_KEYS.every((header, index) => normalized[index] === header);

    if (!duplicateHeaders.length && !missing.length && hasExpectedOrder) {
      return {
        valid: true,
        headers: [...CSV_HEADERS]
      };
    }

    const details = [];

    if (missing.length) {
      details.push(`thiếu cột ${missing.join(', ')}`);
    }

    if (duplicateHeaders.length) {
      details.push('có cột trùng lặp');
    }

    if (!missing.length && !duplicateHeaders.length && !hasExpectedOrder) {
      details.push('các cột chưa đúng thứ tự');
    }

    return {
      valid: false,
      missing,
      duplicateHeaders: [...new Set(duplicateHeaders)],
      message: `Tệp danh sách chưa đúng mẫu: ${details.join('; ')}. ` +
        'Hãy dùng mẫu danh sách đã tải xuống từ TaskFlow.'
    };
  };

  const parseCSVFile = async file => {
    requireActiveUser();

    if (!file) {
      throw new Error('Hãy chọn một tệp danh sách để tiếp tục.');
    }

    if (Number(file.size) > MAX_FILE_SIZE) {
      throw new Error('Tệp danh sách vượt quá dung lượng tối đa 2 MB.');
    }

    if (!isCSVFile(file)) {
      throw new Error('Chỉ chọn tệp danh sách đã tải từ TaskFlow.');
    }

    const text = String(await readFileAsText(file)).replace(/^\uFEFF/, '');
    const matrix = parseCSVText(text);

    if (!matrix.length) {
      throw new Error('Tệp danh sách đang trống.');
    }

    const headerResult = validateHeaders(matrix[0]);

    if (!headerResult.valid) {
      throw new Error(headerResult.message);
    }

    const rows = matrix.slice(1).map((cells, index) => {
      const row = {
        __rowNumber: index + 2
      };

      CSV_HEADERS.forEach((header, columnIndex) => {
        row[header] = cells[columnIndex] ?? '';
      });

      return row;
    });

    return {
      fileName: String(file.name || 'tasks.csv'),
      headers: [...CSV_HEADERS],
      rows
    };
  };

  const valueFor = (row, header, index) => {
    if (Array.isArray(row)) {
      return row[index] ?? '';
    }

    if (!row || typeof row !== 'object') {
      return '';
    }

    if (Object.prototype.hasOwnProperty.call(row, header)) {
      return row[header];
    }

    const matchingKey = Object.keys(row).find(key => {
      return normalizeHeader(key) === normalizeHeader(header);
    });

    return matchingKey ? row[matchingKey] : '';
  };

  const normalizedPriority = value => {
    const key = Utils.normalize(value).replace(/\s+/g, ' ');
    const values = {
      low: 'low',
      thap: 'low',
      p3: 'low',
      p4: 'low',
      medium: 'medium',
      'trung binh': 'medium',
      p2: 'medium',
      high: 'high',
      cao: 'high',
      p1: 'high'
    };

    return values[key] || '';
  };

  const normalizedStatus = value => {
    const key = Utils.normalize(value).replace(/\s+/g, ' ');
    const values = {
      todo: 'todo',
      'can lam': 'todo',
      pending: 'todo',
      progress: 'progress',
      'dang thuc hien': 'progress',
      doing: 'progress',
      done: 'done',
      completed: 'done',
      complete: 'done',
      'hoan thanh': 'done'
    };

    return values[key] || '';
  };

  const normalizedBoolean = value => {
    const key = Utils.normalize(value);

    if (['1', 'true', 'yes', 'co', 'x'].includes(key)) {
      return true;
    }

    return false;
  };

  const normalizedNumber = value => {
    const text = cleanText(value);

    if (!text) {
      return null;
    }

    const normalized = text.includes(',') && !text.includes('.') ?
      text.replace(',', '.') :
      text;
    const number = Number(normalized);

    return Number.isFinite(number) ? number : Number.NaN;
  };

  const normalizedTags = value => {
    const unique = new Set();

    return String(value || '')
      .split(/[;,|]/)
      .map(tag => cleanText(tag).slice(0, 40))
      .filter(tag => {
        const key = Utils.normalize(tag);

        if (!key || unique.has(key)) {
          return false;
        }

        unique.add(key);
        return true;
      })
      .slice(0, 8);
  };

  const normalizeImportRow = (source, index) => {
    const rowNumber = Number(source?.__rowNumber) || index + 2;
    const errors = [];
    const warnings = [];
    const title = cleanText(valueFor(source, 'Title', 0));
    let description = cleanText(valueFor(source, 'Description', 1));
    let deadline = cleanText(valueFor(source, 'Deadline', 2));
    const priorityCell = cleanText(valueFor(source, 'Priority', 3));
    const statusCell = cleanText(valueFor(source, 'Status', 4));
    const categoryName = cleanText(valueFor(source, 'Category', 5));
    const labels = normalizedTags(valueFor(source, 'Labels', 6));
    const progressCell = normalizedNumber(valueFor(source, 'Progress', 7));
    const estimateCell = normalizedNumber(valueFor(source, 'Estimated Hours', 8));
    const pinned = normalizedBoolean(valueFor(source, 'Pinned', 9));
    const priority = priorityCell ? normalizedPriority(priorityCell) : 'medium';
    const status = statusCell ? normalizedStatus(statusCell) : 'todo';

    if (!title) {
      errors.push('thiếu tiêu đề');
    } else if (title.length > 120) {
      errors.push('tiêu đề vượt quá 120 ký tự');
    }

    if (!description) {
      description = 'Không có mô tả.';
      warnings.push('đã thêm mô tả mặc định');
    } else if (description.length < 10) {
      errors.push('mô tả cần ít nhất 10 ký tự');
    } else if (description.length > 1000) {
      errors.push('mô tả vượt quá 1000 ký tự');
    }

    if (!deadline) {
      deadline = Utils.todayISO();
      warnings.push('đã đặt hạn hôm nay');
    } else if (!Validators.isValidISODate(deadline)) {
      errors.push('hạn hoàn thành phải theo dạng YYYY-MM-DD');
    }

    if (!priority) {
      errors.push('mức ưu tiên không hợp lệ');
    }

    if (!status) {
      errors.push('trạng thái không hợp lệ');
    }

    let progress = progressCell;

    if (progress === null) {
      progress = status === 'done' ? 100 : 0;
    } else if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      errors.push('tiến độ phải từ 0 đến 100');
    } else {
      progress = Math.round(progress);
    }

    if (status === 'done') {
      progress = 100;
    } else if (status === 'todo' && progress >= 100) {
      progress = 0;
      warnings.push('đã điều chỉnh tiến độ của việc cần làm');
    } else if (status === 'progress' && progress >= 100) {
      progress = 25;
      warnings.push('đã điều chỉnh tiến độ đang thực hiện');
    }

    let estimate = estimateCell;

    if (estimate === null) {
      estimate = 0;
    } else if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1000) {
      errors.push('thời gian dự kiến phải từ 0 đến 1000 giờ');
    }

    const safeCategoryName = categoryName.length >= 2 && categoryName.length <= 40 ?
      categoryName :
      '';

    if (categoryName && !safeCategoryName) {
      warnings.push('đã bỏ qua danh mục không hợp lệ');
    }

    return {
      valid: !errors.length,
      rowNumber,
      errors,
      warnings,
      data: {
        title,
        description,
        deadline,
        priority,
        status,
        categoryName: safeCategoryName,
        tags: labels,
        progress,
        estimate,
        pinned
      }
    };
  };

  const previewImport = rows => {
    requireActiveUser();

    const sourceRows = Array.isArray(rows) ? rows : [];
    const validRows = [];
    const invalidRows = [];
    let warningCount = 0;

    sourceRows.forEach((row, index) => {
      const normalized = normalizeImportRow(row, index);

      warningCount += normalized.warnings.length;

      if (normalized.valid) {
        validRows.push(normalized);
      } else {
        invalidRows.push(normalized);
      }
    });

    const existingCategories = new Set(
      CategoryService.getAll()
        .map(category => Utils.normalize(category?.name))
        .filter(Boolean)
    );
    const categoriesToCreate = [];
    const plannedCategories = new Set(existingCategories);

    validRows.forEach(row => {
      const name = row.data.categoryName;
      const key = Utils.normalize(name);

      if (key && !plannedCategories.has(key)) {
        plannedCategories.add(key);
        categoriesToCreate.push(name);
      }
    });

    return {
      total: sourceRows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      warningCount,
      rows: validRows,
      invalidRows,
      categoriesToCreate
    };
  };

  const taskSignature = task => [
    Utils.normalize(task.title),
    task.deadline,
    Utils.normalize(task.description)
  ].join('\u0000');

  const buildCategoriesForImport = rows => {
    const categories = CategoryService.getAll().map(category => ({
      ...category
    }));
    const idsByName = new Map();

    categories.forEach(category => {
      const key = Utils.normalize(category.name);

      if (key && !idsByName.has(key)) {
        idsByName.set(key, category.id);
      }
    });

    const created = [];

    rows.forEach(row => {
      const name = row.data.categoryName;
      const key = Utils.normalize(name);

      if (!key || idsByName.has(key)) {
        return;
      }

      const category = {
        id: Utils.uid('cat'),
        name,
        color: CONFIG.DEFAULT_CATEGORY_COLOR,
        icon: '📁',
        createdAt: new Date().toISOString()
      };

      categories.push(category);
      idsByName.set(key, category.id);
      created.push(category);
    });

    return {
      categories,
      idsByName,
      created
    };
  };

  const importTasks = (rows, mode = 'merge') => {
    try {
      requireActiveUser();

      const preview = previewImport(rows);

      if (!preview.valid) {
        return {
          ok: false,
          message: 'Không tìm thấy công việc hợp lệ trong tệp danh sách.',
          preview
        };
      }

      const safeMode = mode === 'overwrite' ? 'overwrite' : 'merge';
      const currentTasks = TaskService.getTasks();
      const knownTasks = new Set(
        safeMode === 'merge' ? currentTasks.map(taskSignature) : []
      );
      const rowsToImport = [];
      let duplicates = 0;

      preview.rows.forEach(row => {
        const signature = taskSignature(row.data);

        if (knownTasks.has(signature)) {
          duplicates += 1;
          return;
        }

        knownTasks.add(signature);
        rowsToImport.push(row);
      });

      if (!rowsToImport.length) {
        return {
          ok: true,
          count: 0,
          skipped: preview.invalid + duplicates,
          duplicates,
          categoriesCreated: 0,
          preview
        };
      }

      if (safeMode === 'overwrite' && currentTasks.length) {
        const backup = BackupService.createBackup('Trước khi thay thế danh sách');

        if (!backup) {
          return {
            ok: false,
            message: 'Không thể tạo bản sao lưu trước khi thay thế công việc.',
            preview
          };
        }
      }

      const categoryResult = buildCategoriesForImport(rowsToImport);
      const tasks = rowsToImport.map(row => ({
        id: Utils.uid('task'),
        title: row.data.title,
        description: row.data.description,
        deadline: row.data.deadline,
        priority: row.data.priority,
        status: row.data.status,
        categoryId: categoryResult.idsByName.get(
          Utils.normalize(row.data.categoryName)
        ) || '',
        tags: row.data.tags,
        progress: row.data.progress,
        estimate: row.data.estimate,
        pinned: row.data.pinned,
        subtasks: [],
        notes: ''
      }));
      const result = BackupService.importData({
        tasks,
        categories: categoryResult.categories
      }, {
        mode: safeMode,
        activityType: 'csv_import',
        activityText: `Đã nhập ${tasks.length} công việc từ tệp danh sách`
      });

      if (!result?.ok) {
        return {
          ...result,
          preview,
          message: result?.message || 'Không thể nhập công việc từ tệp danh sách.'
        };
      }

      return {
        ...result,
        count: Number(result.tasksAdded || 0),
        skipped: preview.invalid + duplicates + Number(result.tasksSkipped || 0),
        duplicates,
        categoriesCreated: categoryResult.created.length,
        preview
      };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || 'Không thể nhập công việc từ tệp danh sách.'
      };
    }
  };

  return {
    CSV_HEADERS,
    exportTasks,
    downloadTasksCSV,
    parseCSVFile,
    validateHeaders,
    previewImport,
    importTasks
  };
})();
