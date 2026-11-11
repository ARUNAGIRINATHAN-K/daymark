import { useCallback, useEffect, useState } from 'react';
import { networkMonitor } from '../sync/networkMonitor';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => networkMonitor.getStatus().isOnline);
  const [lastCheckedAt, setLastCheckedAt] = useState<number>(() => networkMonitor.getStatus().lastCheckedAt);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((online) => {
      setIsOnline(online);
      setLastCheckedAt(Date.now());
    });

    return unsubscribe;
  }, []);

  const checkConnection = useCallback(async () => {
    const result = await networkMonitor.checkReachability();
    setIsOnline(result);
    setLastCheckedAt(Date.now());
    return result;
  }, []);

  return {
    isOnline,
    checkConnection,
    lastCheckedAt,
  };
}
