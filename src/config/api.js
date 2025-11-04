import axios from 'axios';
import Constants from 'expo-constants';

// API base URL from env or Expo config
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants?.expoConfig?.extra?.apiUrl ?? 'https://phonelock-server.onrender.com/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Device APIs
export const deviceAPI = {
  activateDevice: (data) => api.post('/device/activate', data),
  getDeviceStatus: (key) => api.get(`/device/status/${key}`),
  updateDeviceInfo: (data) => api.post('/device/update', data),
  acknowledgeCommand: (data) => api.post('/device/ack', data),
};

export default api;
