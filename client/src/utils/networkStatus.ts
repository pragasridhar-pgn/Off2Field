import { useEffect, useState } from "react";

/**
 * Returns the current browser online status using navigator.onLine.
 * Defaults to true in non-browser or test environments.
 */
export function getOnlineStatus(): boolean {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

/**
 * Subscribes to native browser online and offline events.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeNetworkStatus(
  callback: (online: boolean) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * React hook that provides the current browser online/offline status,
 * automatically updating when connection state transitions.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => getOnlineStatus());

  useEffect(() => {
    setIsOnline(getOnlineStatus());
    const unsubscribe = subscribeNetworkStatus((online) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
