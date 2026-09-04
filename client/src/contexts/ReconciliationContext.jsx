import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { recApi } from '../services/recApi';
import { useAuth } from './AuthContext';

const ReconciliationContext = createContext(null);

export const useReconciliation = () => {
  const context = useContext(ReconciliationContext);
  if (!context) {
    throw new Error('useReconciliation must be used within a ReconciliationProvider');
  }
  return context;
};

export const ReconciliationProvider = ({ children }) => {
  const { user } = useAuth();
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunId, setSelectedRunIdState] = useState(null);

  const storageKey = user ? `recon-selected-run-${user._id || user.id || user.email}` : null;

  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSelectedRunIdState(stored);
    }
  }, [storageKey]);

  const refreshRuns = useCallback(async () => {
    if (!user) return;
    setRunsLoading(true);
    try {
      const response = await recApi.listRuns({ limit: 100 });
      setRuns(response.data?.data || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshRuns();
    else {
      setRuns([]);
      setSelectedRunIdState(null);
    }
  }, [user, refreshRuns]);

  const setSelectedRunId = useCallback(
    (id) => {
      setSelectedRunIdState(id || null);
      if (storageKey) {
        if (id) localStorage.setItem(storageKey, id);
        else localStorage.removeItem(storageKey);
      }
    },
    [storageKey]
  );

  const selectedRun = useMemo(
    () => runs.find((r) => String(r._id || r.id) === String(selectedRunId)) || null,
    [runs, selectedRunId]
  );

  const value = useMemo(
    () => ({
      runs,
      runsLoading,
      refreshRuns,
      selectedRunId,
      setSelectedRunId,
      selectedRun,
    }),
    [runs, runsLoading, refreshRuns, selectedRunId, setSelectedRunId, selectedRun]
  );

  return <ReconciliationContext.Provider value={value}>{children}</ReconciliationContext.Provider>;
};
