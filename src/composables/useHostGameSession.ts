import { computed, ref, watch, type WatchStopHandle } from 'vue';
import { closeSession, createSession, publishSession, resumeHostSession as resumeHostSessionRequest } from '@/services/gameSessionApi';
import { createPublishedPlayers } from '@/services/sessionSnapshot';
import { useGameStore } from '@/stores/game';

const HOST_TOKEN_KEY = 'hotel-bank-host-token';
const HOST_SESSION_ID_KEY = 'hotel-bank-host-session-id';
const HOST_SESSION_STARTED_AT_KEY = 'hotel-bank-host-session-started-at';
const HOST_SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const hostToken = ref(readStorage(HOST_TOKEN_KEY));
const hostSessionId = ref(readStorage(HOST_SESSION_ID_KEY));
const hostSessionStartedAt = ref(Number(readStorage(HOST_SESSION_STARTED_AT_KEY)) || 0);
const isCreatingSession = ref(false);
const isClosingSession = ref(false);
const isPublishing = ref(false);
const hostSessionError = ref('');
const hostSessionVersion = ref(0);

let stopPublishingWatch: WatchStopHandle | null = null;
let publishTimer: number | null = null;

function readStorage(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(key) || '';
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}

function clearStorage(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(key);
}

function serializeSnapshotSource() {
  const gameStore = useGameStore();
  return JSON.stringify({
    playerBalances: gameStore.playerBalances,
    propertyOwnerships: gameStore.propertyOwnerships,
  });
}

async function publishCurrentSnapshot() {
  if (!hostToken.value) {
    return;
  }

  const gameStore = useGameStore();
  isPublishing.value = true;
  hostSessionError.value = '';

  try {
    const response = await publishSession(
      hostToken.value,
      createPublishedPlayers(gameStore.playerBalances, gameStore.propertyOwnerships, { includeBankPlayer: true }),
    );
    hostSessionId.value = response.sessionId;
    hostSessionVersion.value = response.version;
  } catch (error) {
    hostSessionError.value = error instanceof Error ? error.message : 'publish-failed';
  } finally {
    isPublishing.value = false;
  }
}

function schedulePublish(delay = 250) {
  if (!hostToken.value || typeof window === 'undefined') {
    return;
  }

  if (publishTimer) {
    window.clearTimeout(publishTimer);
  }

  publishTimer = window.setTimeout(() => {
    publishTimer = null;
    void publishCurrentSnapshot();
  }, delay);
}

function startHostPublishing() {
  if (stopPublishingWatch) {
    return;
  }

  stopPublishingWatch = watch(
    serializeSnapshotSource,
    () => schedulePublish(),
    { flush: 'post' },
  );

  schedulePublish(0);
}

async function startHostSession(password: string) {
  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    hostSessionError.value = 'password-required';
    return false;
  }

  isCreatingSession.value = true;
  hostSessionError.value = '';

  try {
    const response = await createSession(trimmedPassword);
    hostToken.value = response.hostToken;
    hostSessionId.value = response.sessionId;
    hostSessionVersion.value = response.version;
    hostSessionStartedAt.value = Date.now();
    writeStorage(HOST_TOKEN_KEY, response.hostToken);
    writeStorage(HOST_SESSION_ID_KEY, response.sessionId);
    writeStorage(HOST_SESSION_STARTED_AT_KEY, String(hostSessionStartedAt.value));
    startHostPublishing();
    await publishCurrentSnapshot();
    return true;
  } catch (error) {
    hostSessionError.value = error instanceof Error ? error.message : 'create-session-failed';
    return false;
  } finally {
    isCreatingSession.value = false;
  }
}

async function resumeHostSession(password: string) {
  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    hostSessionError.value = 'password-required';
    return false;
  }

  isCreatingSession.value = true;
  hostSessionError.value = '';

  try {
    const response = await resumeHostSessionRequest(trimmedPassword);
    hostToken.value = response.hostToken;
    hostSessionId.value = response.sessionId;
    hostSessionVersion.value = response.version;
    hostSessionStartedAt.value = Date.now();
    writeStorage(HOST_TOKEN_KEY, response.hostToken);
    writeStorage(HOST_SESSION_ID_KEY, response.sessionId);
    writeStorage(HOST_SESSION_STARTED_AT_KEY, String(hostSessionStartedAt.value));
    startHostPublishing();
    await publishCurrentSnapshot();
    return true;
  } catch (error) {
    hostSessionError.value = error instanceof Error ? error.message : 'resume-session-failed';
    return false;
  } finally {
    isCreatingSession.value = false;
  }
}

function stopHostPublishing() {
  if (stopPublishingWatch) {
    stopPublishingWatch();
    stopPublishingWatch = null;
  }

  if (publishTimer && typeof window !== 'undefined') {
    window.clearTimeout(publishTimer);
    publishTimer = null;
  }
}

function clearHostSession() {
  stopHostPublishing();
  hostToken.value = '';
  hostSessionId.value = '';
  hostSessionVersion.value = 0;
  hostSessionStartedAt.value = 0;
  hostSessionError.value = '';
  clearStorage(HOST_TOKEN_KEY);
  clearStorage(HOST_SESSION_ID_KEY);
  clearStorage(HOST_SESSION_STARTED_AT_KEY);
}

async function closeHostSession() {
  if (!hostToken.value) {
    clearHostSession();
    return true;
  }

  isClosingSession.value = true;
  hostSessionError.value = '';

  try {
    await closeSession(hostToken.value);
    clearHostSession();
    return true;
  } catch (error) {
    hostSessionError.value = error instanceof Error ? error.message : 'close-session-failed';
    return false;
  } finally {
    isClosingSession.value = false;
  }
}

export function useHostGameSession() {
  const hasHostSession = computed(() => Boolean(hostToken.value));
  const canReplaceHostSession = computed(() => !hostToken.value ||
    !hostSessionStartedAt.value ||
    (Date.now() - hostSessionStartedAt.value) > HOST_SESSION_MAX_AGE_MS);

  return {
    hostToken,
    hostSessionId,
    hostSessionVersion,
    hostSessionStartedAt,
    hasHostSession,
    canReplaceHostSession,
    isCreatingSession,
    isClosingSession,
    isPublishing,
    hostSessionError,
    startHostSession,
    resumeHostSession,
    startHostPublishing,
    publishCurrentSnapshot,
    closeHostSession,
    clearHostSession,
  };
}
