'use strict';

const DEFAULT_ACCENT_COLOR = '#6d5dfc';

const CONFIG = Object.freeze({
  APP_NAME: 'TaskFlow',
  VERSION: '1.6.6',
  // These markers identify one-time compatibility work for data written by
  // releases that stored workspace values without a user suffix.
  LEGACY_CLEANUP_VERSION: '1.6.1',
  LEGACY_MIGRATION_VERSION: '1.6.1',
  DEFAULT_ACCENT: DEFAULT_ACCENT_COLOR,
  DEFAULT_CATEGORY_COLOR: '#64748b',
  DEFAULT_SETTINGS: Object.freeze({
    theme: 'light',
    accent: DEFAULT_ACCENT_COLOR,
    compact: false,
    sidebarCollapsed: false,
    viewMode: 'list'
  }),
  DEFAULT_CATEGORIES: Object.freeze([{
    id: 'cat_study',
    name: 'Học tập',
    color: DEFAULT_ACCENT_COLOR,
    icon: '📚'
  }, {
    id: 'cat_work',
    name: 'Công việc',
    color: '#2563eb',
    icon: '💼'
  }, {
    id: 'cat_personal',
    name: 'Cá nhân',
    color: '#ec4899',
    icon: '✨'
  }, {
    id: 'cat_health',
    name: 'Sức khỏe',
    color: '#10b981',
    icon: '🏃'
  }, {
    id: 'cat_project',
    name: 'Dự án',
    color: '#f59e0b',
    icon: '🚀'
  }]),
  STORAGE: Object.freeze({
    USERS: 'taskflow_users_v1',
    SESSION: 'taskflow_session_v1',
    LAST_EMAIL: 'taskflow_last_email_v1',
    TASKS: 'taskflow_tasks_v1',
    CATEGORIES: 'taskflow_categories_v1',
    SETTINGS: 'taskflow_settings_v1',
    ACTIVITIES: 'taskflow_activities_v1',
    BACKUPS: 'taskflow_backups_v1',
    SEEDED: 'taskflow_seeded_v1',
    LEGACY_SNAPSHOT: 'taskflow_legacy_snapshot_v1_5_1',
    LEGACY_CLEANUP: 'taskflow_legacy_cleanup_v1_5_1',
    LEGACY_MIGRATION: 'taskflow_legacy_migration_v1_6_1'
  }),
  USER_SCOPED_STORAGE: Object.freeze([
    'taskflow_tasks_v1',
    'taskflow_categories_v1',
    'taskflow_settings_v1',
    'taskflow_activities_v1',
    'taskflow_backups_v1',
    'taskflow_seeded_v1'
  ]),
  STATUSES: Object.freeze([{
    value: 'todo',
    label: 'Cần làm',
    icon: 'circle',
    color: '#64748b'
  }, {
    value: 'progress',
    label: 'Đang thực hiện',
    icon: 'loader',
    color: '#f59e0b'
  }, {
    value: 'done',
    label: 'Hoàn thành',
    icon: 'checkCircle',
    color: '#10b981'
  }]),
  PRIORITIES: Object.freeze([{
    value: 'low',
    label: 'Thấp',
    color: '#22c55e',
    weight: 1
  }, {
    value: 'medium',
    label: 'Trung bình',
    color: '#f59e0b',
    weight: 2
  }, {
    value: 'high',
    label: 'Cao',
    color: '#ef4444',
    weight: 3
  }]),
  CATEGORY_COLORS: Object.freeze([
    DEFAULT_ACCENT_COLOR,
    '#2563eb',
    '#0ea5e9',
    '#14b8a6',
    '#10b981',
    '#84cc16',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#64748b'
  ]),
  PAGE_SIZE: 8
});
