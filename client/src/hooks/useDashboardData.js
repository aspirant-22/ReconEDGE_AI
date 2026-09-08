import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useDashboardData(runId, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params = runId ? { runId } : undefined;
      const response = await api.get('/dashboard', { params });
      const payload = response.data;

      if (payload.success && payload.hasData) {
        setData(payload.dashboard);
        setLastUpdated(new Date());
      } else if (payload.success && !payload.hasData) {
        setData(null);
        setLastUpdated(new Date());
      } else {
        setError('Unable to load dashboard data.');
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      if (err.response?.status === 404) {
        setError('The selected reconciliation run does not exist or you do not have access to it.');
        return;
      }
      setError(err.response?.data?.error?.message || 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [runId, enabled]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, lastUpdated, refetch: fetchDashboard };
}
