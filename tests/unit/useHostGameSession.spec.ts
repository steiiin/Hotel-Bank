import { beforeEach, describe, expect, test, vi } from 'vitest';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('useHostGameSession', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  test('clears stale local host session when the server no longer accepts the token', async () => {
    window.localStorage.setItem('hotel-bank-host-token', 'stale-token');
    window.localStorage.setItem('hotel-bank-host-session-id', 'old-session');
    window.localStorage.setItem('hotel-bank-host-session-started-at', String(Date.now()));
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'invalid-host-token' }, false, 403));

    const { useHostGameSession } = await import('@/composables/useHostGameSession');
    const hostSession = useHostGameSession();

    await expect(hostSession.closeHostSession()).resolves.toBe(true);

    expect(hostSession.hasHostSession.value).toBe(false);
    expect(window.localStorage.getItem('hotel-bank-host-token')).toBeNull();
    expect(hostSession.hostSessionError.value).toBe('');
  });

  test('keeps local host session when close fails for another reason', async () => {
    window.localStorage.setItem('hotel-bank-host-token', 'token');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'session-close-failed' }, false, 500));

    const { useHostGameSession } = await import('@/composables/useHostGameSession');
    const hostSession = useHostGameSession();

    await expect(hostSession.closeHostSession()).resolves.toBe(false);

    expect(hostSession.hasHostSession.value).toBe(true);
    expect(window.localStorage.getItem('hotel-bank-host-token')).toBe('token');
    expect(hostSession.hostSessionError.value).toBe('session-close-failed');
  });
});
