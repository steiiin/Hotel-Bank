import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  GameSessionApiError,
  closeSession,
  createSession,
  joinSession,
  publishSession,
  resumeHostSession,
  selectPlayer,
  subscribeToPlayerUpdates,
} from '@/services/gameSessionApi';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('game session api', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('EventSource', undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('creates a host session', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ sessionId: 's1', hostToken: 'token', version: 1 }));

    await expect(createSession('secret')).resolves.toEqual({
      sessionId: 's1',
      hostToken: 'token',
      version: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/session.php?action=create', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    }));
  });

  test('throws api errors with backend code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'invalid-password' }, false, 403));

    await expect(joinSession('bad')).rejects.toMatchObject<GameSessionApiError>({
      status: 403,
      code: 'invalid-password',
    });
  });

  test('resumes a host session with the session password', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ sessionId: 's1', hostToken: 'new-token', version: 4 }));

    await expect(resumeHostSession('secret')).resolves.toEqual({
      sessionId: 's1',
      hostToken: 'new-token',
      version: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/session.php?action=resume-host', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    }));
  });

  test('publishes player snapshots with host token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ sessionId: 's1', version: 2, players: [{ id: 'player-1', name: 'Alice' }] }));

    await publishSession('token', [{
      id: 'player-1',
      name: 'Alice',
      balance: 15000,
      properties: [],
    }]);

    expect(fetchMock).toHaveBeenCalledWith('/api/session.php?action=update', expect.objectContaining({
      body: JSON.stringify({
        hostToken: 'token',
        players: [{
          id: 'player-1',
          name: 'Alice',
          balance: 15000,
          properties: [],
        }],
      }),
    }));
  });

  test('closes a host session with host token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(closeSession('token')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/session.php?action=close', expect.objectContaining({
      body: JSON.stringify({ hostToken: 'token' }),
    }));
  });

  test('polls player updates when event source is unavailable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({
      sessionId: 's1',
      version: 2,
      player: {
        id: 'player-1',
        name: 'Alice',
        balance: 16000,
        properties: [],
      },
      players: [
        { id: 'player-1', name: 'Alice', balance: 16000, properties: [] },
        { id: 'player-2', name: 'Bob', balance: 15000, properties: [] },
      ],
    }));
    const onUpdate = vi.fn();
    const onModeChange = vi.fn();

    const subscription = subscribeToPlayerUpdates({
      sessionId: 's1',
      playerId: 'player-1',
      playerToken: 'player-token',
      password: 'secret',
      since: 1,
      onUpdate,
      onModeChange,
    });

    await vi.advanceTimersByTimeAsync(1);

    expect(onModeChange).toHaveBeenCalledWith('poll');
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      version: 2,
      players: expect.arrayContaining([
        expect.objectContaining({ id: 'player-2', name: 'Bob' }),
      ]),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/session.php?action=select-player', expect.objectContaining({
      body: JSON.stringify({ password: 'secret', playerId: 'player-1' }),
    }));

    subscription.close();
  });

  test('subscribes to player updates for a specific session over event source', () => {
    const addEventListener = vi.fn();
    const close = vi.fn();
    const eventSourceMock = vi.fn().mockImplementation(() => ({
      addEventListener,
      close,
    }));
    vi.stubGlobal('EventSource', eventSourceMock);

    const subscription = subscribeToPlayerUpdates({
      sessionId: 's1',
      playerId: 'player-1',
      playerToken: 'player-token',
      password: 'secret',
      since: 3,
      onUpdate: vi.fn(),
    });

    expect(eventSourceMock).toHaveBeenCalledWith('/api/events.php?sessionId=s1&playerId=player-1&playerToken=player-token&since=3');
    expect(addEventListener).toHaveBeenCalledWith('player', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('error', expect.any(Function));

    subscription.close();
    expect(close).toHaveBeenCalled();
  });

  test('selects one player', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      sessionId: 's1',
      version: 3,
      player: {
        id: 'player-1',
        name: 'Alice',
        balance: 18000,
        properties: [],
      },
      players: [
        { id: 'player-1', name: 'Alice', balance: 18000, properties: [] },
        { id: 'bank-player', name: 'Bank Alice', balance: 15000, properties: [] },
      ],
    }));

    await expect(selectPlayer('secret', 'player-1')).resolves.toMatchObject({
      version: 3,
      player: { id: 'player-1', balance: 18000 },
      players: [
        { id: 'player-1', name: 'Alice', balance: 18000, properties: [] },
        { id: 'bank-player', name: 'Bank Alice', balance: 15000, properties: [] },
      ],
    });
  });
});
