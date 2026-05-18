import { computed, onBeforeUnmount, ref } from 'vue';
import { onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue';

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
};

export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null;
  let shouldKeepAwake = false;
  const isSupported = ref(Boolean((navigator as WakeLockNavigator).wakeLock));
  const isActive = ref(false);

  const handleWakeLockRelease = () => {
    wakeLock = null;
    isActive.value = false;
  };

  async function requestWakeLockInternal() {
    const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLockApi || document.visibilityState !== 'visible') {
      isActive.value = false;
      return false;
    }

    try {
      wakeLock = await wakeLockApi.request('screen');
      wakeLock.addEventListener('release', handleWakeLockRelease);
      isActive.value = true;
      return true;
    } catch {
      wakeLock = null;
      isActive.value = false;
      return false;
    }
  }

  async function requestWakeLock() {
    if (wakeLock || document.visibilityState !== 'visible') {
      return isActive.value;
    }

    return requestWakeLockInternal();
  }

  async function releaseWakeLock() {
    const currentWakeLock = wakeLock;
    wakeLock = null;
    isActive.value = false;

    if (!currentWakeLock) {
      return;
    }

    currentWakeLock.removeEventListener('release', handleWakeLockRelease);
    if (!currentWakeLock.released) {
      await currentWakeLock.release();
    }
  }

  function handleVisibilityChange() {
    if (shouldKeepAwake && document.visibilityState === 'visible') {
      void requestWakeLock();
    }
  }

  onIonViewDidEnter(() => {
    shouldKeepAwake = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void requestWakeLock();
  });

  onIonViewWillLeave(() => {
    shouldKeepAwake = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void releaseWakeLock();
  });

  onBeforeUnmount(() => {
    shouldKeepAwake = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void releaseWakeLock();
  });

  return {
    isSupported: computed(() => isSupported.value),
    isActive: computed(() => isActive.value),
    requestWakeLock,
  };
}
