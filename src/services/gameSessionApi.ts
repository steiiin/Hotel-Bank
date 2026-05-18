import type { PublishedPlayer, PublishedPlayerSummary, PlayerUpdate } from '@/services/sessionSnapshot';

type ApiErrorBody = {
  error?: string;
};

export class GameSessionApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'GameSessionApiError';
    this.status = status;
    this.code = code;
  }
}

export type CreateSessionResponse = {
  sessionId: string;
  hostToken: string;
  version: number;
};

export type ResumeHostSessionResponse = CreateSessionResponse;

export type JoinSessionResponse = {
  sessionId: string;
  version: number;
  players: PublishedPlayerSummary[];
};

export type UpdateSessionResponse = {
  sessionId: string;
  version: number;
  players: PublishedPlayerSummary[];
};

export type CloseSessionResponse = {
  ok: true;
};

export type PlayerSubscription = {
  close: () => void;
};

export type SubscribeOptions = {
  sessionId: string;
  playerId: string;
  playerToken: string;
  password: string;
  since?: number;
  onUpdate: (update: PlayerUpdate) => void;
  onError?: (error: Error) => void;
  onModeChange?: (mode: 'sse' | 'poll') => void;
};

const API_BASE_URL = `${import.meta.env.BASE_URL}api`;

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({} as ApiErrorBody));
  if (!response.ok) {
    throw new GameSessionApiError(response.status, payload.error || 'request-failed');
  }

  return payload as T;
}

export function createSession(password: string): Promise<CreateSessionResponse> {
  return requestJson<CreateSessionResponse>('session.php?action=create', { password });
}

export function joinSession(password: string): Promise<JoinSessionResponse> {
  return requestJson<JoinSessionResponse>('session.php?action=join', { password });
}

export function resumeHostSession(password: string): Promise<ResumeHostSessionResponse> {
  return requestJson<ResumeHostSessionResponse>('session.php?action=resume-host', { password });
}

export function selectPlayer(password: string, playerId: string): Promise<PlayerUpdate> {
  return requestJson<PlayerUpdate>('session.php?action=select-player', { password, playerId });
}

export function publishSession(hostToken: string, players: PublishedPlayer[]): Promise<UpdateSessionResponse> {
  return requestJson<UpdateSessionResponse>('session.php?action=update', { hostToken, players });
}

export function closeSession(hostToken: string): Promise<CloseSessionResponse> {
  return requestJson<CloseSessionResponse>('session.php?action=close', { hostToken });
}

export function subscribeToPlayerUpdates(options: SubscribeOptions): PlayerSubscription {
  let closed = false;
  let eventSource: EventSource | null = null;
  let pollTimer: number | null = null;
  let lastVersion = options.since ?? 0;
  let mode: 'sse' | 'poll' | null = null;

  function setMode(nextMode: 'sse' | 'poll') {
    if (mode === nextMode) {
      return;
    }

    mode = nextMode;
    options.onModeChange?.(nextMode);
  }

  function handleUpdate(update: PlayerUpdate) {
    if (update.version <= lastVersion) {
      return;
    }

    lastVersion = update.version;
    options.onUpdate(update);
  }

  function schedulePoll(delay = 1000) {
    if (closed || pollTimer) {
      return;
    }

    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      if (closed) {
        return;
      }

      try {
        const update = await selectPlayer(options.password, options.playerId);
        handleUpdate(update);
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error('poll-failed'));
      } finally {
        schedulePoll(1000);
      }
    }, delay);
  }

  function startPolling(delay = 0) {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    setMode('poll');
    schedulePoll(delay);
  }

  if (typeof window.EventSource === 'function') {
    const params = new URLSearchParams({
      sessionId: options.sessionId,
      playerId: options.playerId,
      playerToken: options.playerToken,
      since: String(lastVersion),
    });
    eventSource = new EventSource(`${API_BASE_URL}/events.php?${params.toString()}`);
    setMode('sse');

    eventSource.addEventListener('player', (event) => {
      try {
        handleUpdate(JSON.parse((event as MessageEvent).data) as PlayerUpdate);
      } catch {
        options.onError?.(new Error('invalid-event'));
      }
    });

    eventSource.addEventListener('error', () => {
      if (!closed) {
        startPolling(0);
      }
    });
  } else {
    startPolling(0);
  }

  return {
    close: () => {
      closed = true;
      eventSource?.close();
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
    },
  };
}
