import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOnlineStatus, subscribeNetworkStatus } from './networkStatus';

describe('networkStatus utility test suite', () => {
  it('returns a boolean online status', () => {
    const online = getOnlineStatus();
    expect(typeof online).toBe('boolean');
    expect(online).toBe(true);
  });

  it('subscribes and unsubscribes cleanly in environments with event listeners', () => {
    // Create mock window if undefined in test runner
    const listeners: Record<string, Function[]> = {};
    const mockWindow = {
      addEventListener: (evt: string, fn: Function) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      removeEventListener: (evt: string, fn: Function) => {
        listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
      },
    };

    (globalThis as any).window = mockWindow;

    const callback = vi.fn();
    const unsubscribe = subscribeNetworkStatus(callback);

    // Trigger online
    (listeners['online'] || []).forEach((fn) => fn());
    expect(callback).toHaveBeenCalledWith(true);

    // Trigger offline
    (listeners['offline'] || []).forEach((fn) => fn());
    expect(callback).toHaveBeenCalledWith(false);

    // Unsubscribe
    unsubscribe();
    callback.mockClear();
    (listeners['online'] || []).forEach((fn) => fn());
    expect(callback).not.toHaveBeenCalled();

    delete (globalThis as any).window;
  });
});
