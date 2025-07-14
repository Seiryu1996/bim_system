import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { projectService } from '../services/projectService';
import { ProjectState, Project, ProjectRequest } from '../types';

const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  selectedObject: null,
  objectProperties: {},
  isLoading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk(
  'project/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Redux: fetchProjects開始');
      const result = await projectService.getProjects();
      console.log('Redux: fetchProjects成功', result);
      return result;
    } catch (error: any) {
      console.error('Redux: fetchProjects失敗', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch projects');
    }
  }
);

export const createProject = createAsyncThunk(
  'project/createProject',
  async (projectData: ProjectRequest, { rejectWithValue }) => {
    try {
      return await projectService.createProject(projectData);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create project');
    }
  }
);

export const updateProject = createAsyncThunk(
  'project/updateProject',
  async ({ id, data }: { id: number; data: ProjectRequest }, { rejectWithValue }) => {
    try {
      return await projectService.updateProject(id, data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update project');
    }
  }
);

export const deleteProject = createAsyncThunk(
  'project/deleteProject',
  async (id: number, { rejectWithValue }) => {
    try {
      await projectService.deleteProject(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete project');
    }
  }
);

export const updateObjectProperties = createAsyncThunk(
  'project/updateObjectProperties',
  async ({ projectId, objectId, properties }: { projectId: number; objectId: string; properties: Record<string, any> }, { rejectWithValue }) => {
    try {
      await projectService.updateObjectProperties(projectId, objectId, properties);
      return { objectId, properties };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update object properties');
    }
  }
);

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
    setSelectedObject: (state, action: PayloadAction<any>) => {
      state.selectedObject = action.payload;
    },
    setObjectProperties: (state, action: PayloadAction<Record<string, any>>) => {
      state.objectProperties = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
        state.isLoading = false;
        state.projects = action.payload || [];
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(createProject.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action: PayloadAction<Project>) => {
        state.isLoading = false;
        if (state.projects) {
          state.projects.push(action.payload);
        } else {
          state.projects = [action.payload];
        }
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateProject.fulfilled, (state, action: PayloadAction<Project>) => {
        const index = state.projects.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      .addCase(deleteProject.fulfilled, (state, action: PayloadAction<number>) => {
        state.projects = state.projects.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      .addCase(updateObjectProperties.fulfilled, (state, action) => {
        const { objectId, properties } = action.payload;
        state.objectProperties[objectId] = properties;
      });
  },
});

export const { setCurrentProject, setSelectedObject, setObjectProperties, clearError } = projectSlice.actions;
export default projectSlice.reducer;