'use strict';

const ActivityService = (() => {
  const MAX_ACTIVITY_COUNT = 100;

  const getActivityList = () => {
    const activities = Storage.read(CONFIG.STORAGE.ACTIVITIES, []);

    return Array.isArray(activities) ? activities : [];
  };

  const getActivities = (limit = 50) => getActivityList().slice(0, limit);

  const createActivity = (type, text, refId = '') => ({
    id: Utils.uid('act'),
    type: String(type || 'activity'),
    text: String(text || '').trim(),
    refId: String(refId || ''),
    createdAt: new Date().toISOString()
  });

  const prependActivity = (activity, activities = getActivityList()) => {
    return [activity, ...activities].slice(0, MAX_ACTIVITY_COUNT);
  };

  const saveActivities = activities => Storage.write(
    CONFIG.STORAGE.ACTIVITIES,
    Array.isArray(activities) ? activities.slice(0, MAX_ACTIVITY_COUNT) : []
  );

  const logActivity = (type, text, refId = '') => {
    const activities = prependActivity(createActivity(type, text, refId));

    return saveActivities(activities).ok;
  };

  return {
    MAX_ACTIVITY_COUNT,
    getActivityList,
    getActivities,
    createActivity,
    prependActivity,
    saveActivities,
    logActivity
  };
})();
