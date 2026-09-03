import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/dashboard');
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
      setError(err.response?.data?.error?.message || 'Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, lastUpdated, refetch: fetchDashboard };
}
