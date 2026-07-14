import api from './api';

export const getEvents = (month) => api.get('/calendar', { params: { month } }).then(r => r.data.events);
export const getTaggableUsers = () => api.get('/calendar/taggable-users').then(r => r.data.users);
export const createEvent = (payload) => api.post('/calendar', payload).then(r => r.data.event);
export const updateEvent = (id, payload) => api.put(`/calendar/${id}`, payload).then(r => r.data.event);
export const deleteEvent = (id) => api.delete(`/calendar/${id}`);
