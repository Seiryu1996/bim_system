export interface Project {
  id: number;
  name: string;
  description: string;
  file_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRequest {
  name: string;
  description: string;
  file_id: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  selectedObject: any | null;
  objectProperties: Record<string, any>;
  isLoading: boolean;
  error: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ForgeToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}