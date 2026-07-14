import api from './api';

export const getNotifications = () => api.get('/notifications').then(r => r.data.notifications);
export const getUnreadCount = () => api.get('/notifications/unread-count').then(r => r.data.count);
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`).then(r => r.data.notification);
export const markAllNotificationsRead = () => api.put('/notifications/read-all');
