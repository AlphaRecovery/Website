import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function usePortalData(paths) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextData = {};
      for (const [key, path] of paths) {
        nextData[key] = await api(path);
      }
      setData(nextData);
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [paths]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function currentSection(basePath, pathname) {
  const cleanBase = basePath.replace(/\/$/, '');
  const cleanPath = pathname.replace(/\/$/, '');
  if (cleanPath === cleanBase) return 'dashboard';
  return cleanPath.slice(cleanBase.length + 1).split('/')[0] || 'dashboard';
}
