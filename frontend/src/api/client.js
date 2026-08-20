import axios from 'axios';

// Local dev: VITE_BACKEND_URL points at the standalone backend (localhost:4000).
// Production build: leave VITE_BACKEND_URL unset/empty to call the same origin.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';
const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/api';

const api = axios.create({
  baseURL: `${BACKEND_URL}${API_BASE_PATH}`,
});

export default api;
