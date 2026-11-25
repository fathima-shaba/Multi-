import { useEffect, useState } from 'react';
import { accountRequest } from './account';
import { formatINR } from '../utils/money';

export const formatPaise = value => formatINR(value / 100);

export function useCommerceQuery(path) {
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const current = result?.path === path && result.revision === revision ? result : null;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    accountRequest(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ path, revision, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path, revision, error: error.message, status: error.status });
    });
    return () => controller.abort();
  }, [path, revision]);
  return { ...current, loading: Boolean(path && !current), retry: () => setRevision(value => value + 1) };
}
