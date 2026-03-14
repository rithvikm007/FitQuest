import React, { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getPendingCount } from '@/services/db/syncQueueService';
import { getUser } from '@/services/db/userDbService';
import { performSync } from '@/services/syncService';

type SyncContextValue = {
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingCount: number;
  syncError: string | null;
  sync: () => Promise<void>;
  getPendingChanges: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshLastSynced = useCallback(async (): Promise<void> => {
    const user = await getUser();

    if (!user?.lastSynced) {
      setLastSynced(null);
      return;
    }

    const parsed = new Date(user.lastSynced);
    setLastSynced(Number.isNaN(parsed.getTime()) ? null : parsed);
  }, []);

  const getPendingChanges = useCallback(async (): Promise<void> => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
      setSyncError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncError(message);
      throw error;
    }
  }, []);

  const sync = useCallback(async (): Promise<void> => {
    if (!token) {
      const error = new Error('Not authenticated. Unable to sync.');
      setSyncError(error.message);
      throw error;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const summary = await performSync(token);

      if (summary.errors.length > 0) {
        setSyncError(summary.errors.join('\n'));
      }

      await getPendingChanges();
      await refreshLastSynced();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncError(message);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [getPendingChanges, refreshLastSynced, token]);

  useEffect(() => {
    const loadSyncState = async () => {
      try {
        await getPendingChanges();
        await refreshLastSynced();
      } catch {
        // syncError state is already set by called functions.
      }
    };

    loadSyncState();
  }, [getPendingChanges, refreshLastSynced]);

  useEffect(() => {
    const loadLastSyncedOnAuthChange = async () => {
      try {
        await refreshLastSynced();
      } catch {
        // Preserve existing value on read failures.
      }
    };

    loadLastSyncedOnAuthChange();
  }, [token, refreshLastSynced]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        lastSynced,
        pendingCount,
        syncError,
        sync,
        getPendingChanges,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }

  return context;
}
