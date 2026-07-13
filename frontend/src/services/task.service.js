import api from './api';

export const getMyTasks = () => api.get('/tasks/my').then(r => r.data.tasks);
export const getTeamTasks = () => api.get('/tasks/team').then(r => r.data.tasks);
export const getTask = (id) => api.get(`/tasks/${id}`).then(r => r.data);
export const getAssignableUsers = () => api.get('/tasks/assignable-users').then(r => r.data.users);
export const createTask = (payload) => api.post('/tasks', payload).then(r => r.data.task);
export const updateTask = (id, payload) => api.put(`/tasks/${id}`, payload).then(r => r.data.task);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const submitStatusUpdate = (id, payload) => api.post(`/tasks/${id}/status`, payload).then(r => r.data);
