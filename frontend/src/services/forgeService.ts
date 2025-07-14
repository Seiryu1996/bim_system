import axios from 'axios';
import { ForgeToken } from '../types';

const FORGE_CLIENT_ID = import.meta.env.VITE_FORGE_CLIENT_ID;
const FORGE_CLIENT_SECRET = import.meta.env.VITE_FORGE_CLIENT_SECRET;

export const forgeService = {
  async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        'https://developer.api.autodesk.com/authentication/v1/authenticate',
        {
          client_id: FORGE_CLIENT_ID,
          client_secret: FORGE_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'data:read data:write'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Forge access token:', error);
      throw error;
    }
  },

  async getForgeViewerToken(): Promise<string> {
    try {
      const response = await axios.post(
        'https://developer.api.autodesk.com/authentication/v1/authenticate',
        {
          client_id: FORGE_CLIENT_ID,
          client_secret: FORGE_CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: 'viewables:read'
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('Failed to get Forge viewer token:', error);
      throw error;
    }
  }
};