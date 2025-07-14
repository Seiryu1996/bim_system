import axios from 'axios';
import { ForgeToken } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Axiosインスタンスを作成してJWTトークンを自動で追加
const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const forgeService = {
  async getAccessToken(): Promise<string> {
    try {
      const response = await apiClient.post('/api/forge/token', {
        scope: 'data:read data:write'
      });
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Forge access token:', error);
      throw error;
    }
  },

  async getForgeViewerToken(): Promise<string> {
    try {
      const response = await apiClient.post('/api/forge/token', {
        scope: 'viewables:read'
      });
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Forge viewer token:', error);
      throw error;
    }
  }
};