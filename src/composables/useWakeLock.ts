import { onBeforeUnmount } from 'vue';
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

  const handleWakeLockRelease = () => {
    wakeLock = null;
  };

  async function requestWakeLock() {
    if (wakeLock || document.visibilityState !== 'visible') {
      return;
    }

    const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLockApi) {
      return;
    }

    try {
      wakeLock = await wakeLockApi.request('screen');
      wakeLock.addEventListener('release', handleWakeLockRelease);
    } catch {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    const currentWakeLock = wakeLock;
    wakeLock = null;

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
}
