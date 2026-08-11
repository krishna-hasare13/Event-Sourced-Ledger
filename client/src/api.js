import axios from 'axios';

const STORAGE_KEY = 'ledger.auth.token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
});

let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '' : '';

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

export function setAuthToken(token) {
  authToken = token || '';
  if (typeof localStorage !== 'undefined') {
    if (authToken) {
      localStorage.setItem(STORAGE_KEY, authToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function clearAuthToken() {
  setAuthToken('');
}

export function getStoredToken() {
  return authToken;
}

export const register = (email, password) => api.post('/auth/register', { email, password }).then((r) => {
  setAuthToken(r.data.token);
  return r.data;
});

export const login = (email, password) => api.post('/auth/login', { email, password }).then((r) => {
  setAuthToken(r.data.token);
  return r.data;
});

export const getAccounts = ({ cursor, limit } = {}) => api.get('/accounts', { params: { cursor, limit } }).then(r => r.data);
export const createAccount = (name, type) => api.post('/accounts', { name, type }).then(r => r.data);
export const getBalance = (id, asOf) => api.get(`/accounts/${id}/balance`, { params: { asOf } }).then(r => r.data);
export const getAudit = (id, cursor, limit) => api.get(`/accounts/${id}/audit`, { params: { cursor, limit } }).then(r => r.data);
export const createTransaction = (description, entries) =>
  api.post('/transactions', { description, entries }).then(r => r.data);

export default api;