import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

vi.mock('@/react-app/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useOnlineStatus — estado inicial', () => {
  it('isOnline reflete navigator.onLine inicial (true)', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('isOnline reflete navigator.onLine inicial (false)', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('isSyncing começa false', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isSyncing).toBe(false);
  });

  it('syncError começa null', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.syncError).toBeNull();
  });
});

describe('useOnlineStatus — transições', () => {
  it('transição online → offline ao evento offline', async () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('transição offline → online após pings bem-sucedidos', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.isOnline).toBe(true), { timeout: 5000 });
  });

  it('mantém offline quando pings falham', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await new Promise((r) => setTimeout(r, 3500));
    expect(result.current.isOnline).toBe(false);
  });
});

describe('useOnlineStatus — iOS', () => {
  it('isIos true quando user agent é iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isIos).toBe(true);
  });

  it('isIos false quando user agent é desktop', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isIos).toBe(false);
  });
});

describe('useOnlineStatus — sync', () => {
  it('isSyncing fica true durante onSync e false depois', async () => {
    let resolveFn!: () => void;
    const onSync = vi.fn(
      () => new Promise<void>((resolve) => { resolveFn = resolve; })
    );

    mockFetch.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useOnlineStatus(onSync));

    act(() => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(result.current.isSyncing).toBe(true), { timeout: 5000 });

    act(() => resolveFn());

    await waitFor(() => expect(result.current.isSyncing).toBe(false));
    expect(onSync).toHaveBeenCalled();
  });

  it('syncError definido quando onSync lança', async () => {
    const onSync = vi.fn().mockRejectedValue(new Error('sync failed'));
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useOnlineStatus(onSync));

    act(() => { window.dispatchEvent(new Event('online')); });

    await waitFor(() => expect(result.current.syncError).not.toBeNull(), { timeout: 5000 });
    expect(result.current.isSyncing).toBe(false);
  });
});

describe('useOnlineStatus — cleanup', () => {
  it('remove event listeners ao desmontar', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    const addCalls = addSpy.mock.calls.filter(([e]) => e === 'online' || e === 'offline');
    const removeCalls = removeSpy.mock.calls.filter(([e]) => e === 'online' || e === 'offline');

    expect(addCalls).toHaveLength(2);
    expect(removeCalls).toHaveLength(2);
  });
});
