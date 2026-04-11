import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import {
  getMe,
  login as apiLogin,
  normalizeBackendUser,
  register as apiRegister,
  updateProfile as apiUpdateProfile,
} from '@/services/api';
import {
  clearUser,
  getUser,
  saveUser,
  updateUserProfile,
} from '@/services/db/userDbService';
import type { User } from '@/types/models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_KEY = '@fitquest_token';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  loadStoredAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStoredUserFromBackend = async (storedToken: string): Promise<void> => {
    try {
      const envelope = await getMe(storedToken);
      const backendUser = envelope.data.user;
      const localUser = await getUser();
      const normalized = normalizeBackendUser(backendUser, localUser?.id);
      await saveUser(normalized);

      const refreshedUser = await getUser();
      if (refreshedUser) {
        setUser(refreshedUser);
      }
    } catch {
      // Network unavailable or token stale — keep cached local user.
    }
  };

  // -------------------------------------------------------------------------
  // loadStoredAuth
  // -------------------------------------------------------------------------

  const loadStoredAuth = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);

      if (!storedToken) {
        return;
      }

      const localUser = await getUser();

      if (localUser) {
        setToken(storedToken);
        setUser(localUser);

        // Do not block startup on network requests while restoring auth.
        void refreshStoredUserFromBackend(storedToken);
      } else {
        // No local user means nothing to restore — discard the orphaned token.
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Run once on mount.
  useEffect(() => {
    loadStoredAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const envelope = await apiLogin(email, password);
      const { user: backendUser, token: newToken } = envelope.data;

      const localUser = await getUser();
      const normalized = normalizeBackendUser(backendUser, localUser?.id);

      await saveUser(normalized);
      await AsyncStorage.setItem(TOKEN_KEY, newToken);

      const savedUser = await getUser();
      setToken(newToken);
      setUser(savedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  const register = async (username: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const envelope = await apiRegister(username, email, password);
      const { user: backendUser, token: newToken } = envelope.data;

      const normalized = normalizeBackendUser(backendUser);

      await saveUser(normalized);
      await AsyncStorage.setItem(TOKEN_KEY, newToken);

      const savedUser = await getUser();
      setToken(newToken);
      setUser(savedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await clearUser();
      setToken(null);
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  const updateProfile = async (profile: Partial<User>): Promise<void> => {
    if (!token) {
      throw new Error('Not authenticated.');
    }

    setError(null);
    try {
      const envelope = await apiUpdateProfile(token, profile);
      const backendUser = envelope.data.user;

      const normalized = normalizeBackendUser(backendUser, user?.id);
      await updateUserProfile(normalized);

      const updatedUser = await getUser();
      setUser(updatedUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        logout,
        updateProfile,
        loadStoredAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
