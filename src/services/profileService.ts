import { authService } from './authService';
import type { UserProfile } from '../types';

export const profileService = {
  getProfile: async (): Promise<UserProfile | null> => authService.getUser(),

  updateProfile: async (updates: Partial<UserProfile>): Promise<void> => {
    await authService.updateProfile(updates);
  }
};