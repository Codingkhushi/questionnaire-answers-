import axios from 'axios';

const BASE = 'http://localhost:8000/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    console.log('Attaching Token to request:', config.url);
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('No token found in localStorage for request:', config.url);
  }
  return config;
}, error => {
  return Promise.reject(error);
});

export default api;