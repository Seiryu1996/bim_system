import axios from 'axios';
import { Project, ProjectRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const projectService = {
  async getProjects(): Promise<Project[]> {
    const response = await api.get('/api/projects');
    return response.data;
  },

  async getProject(id: number): Promise<Project> {
    const response = await api.get(`/api/projects/${id}`);
    return response.data;
  },

  async createProject(projectData: ProjectRequest): Promise<Project> {
    const response = await api.post('/api/projects', projectData);
    return response.data;
  },

  async updateProject(id: number, projectData: ProjectRequest): Promise<Project> {
    const response = await api.put(`/api/projects/${id}`, projectData);
    return response.data;
  },

  async deleteProject(id: number): Promise<void> {
    await api.delete(`/api/projects/${id}`);
  },

  async updateObjectProperties(projectId: number, objectId: string, properties: Record<string, any>): Promise<void> {
    await api.patch(`/api/projects/${projectId}/objects/${objectId}`, properties);
  },
};