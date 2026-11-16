import { useCallback, useEffect, useState } from 'react';
import { ApiError, spamGuardApi } from '../services/api';
import type { HealthResponse } from '../types/api';

export function useBackendHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [backendUnreachable, setBackendUnreachable] = useState<boolean>(false);

  const refreshHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spamGuardApi.getHealth();
      setHealth(data);
      setError(null);
      setBackendUnreachable(false);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(
        apiErr?.message ||
          'Backend connection check failed. Verify Flask is running.',
      );
      setBackendUnreachable(apiErr?.backendUnreachable ?? true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  return {
    health,
    loading,
    error,
    backendUnreachable,
    refreshHealth,
  };
}
