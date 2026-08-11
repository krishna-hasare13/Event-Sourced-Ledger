import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api'
});

export const getAccounts = () => api.get('/accounts').then(r => r.data);
export const createAccount = (name, type) => api.post('/accounts', { name, type }).then(r => r.data);
export const getBalance = (id) => api.get(`/accounts/${id}/balance`).then(r => r.data);
export const getAudit = (id) => api.get(`/accounts/${id}/audit`).then(r => r.data);
export const createTransaction = (description, entries) =>
  api.post('/transactions', { description, entries }).then(r => r.data);

export default api;