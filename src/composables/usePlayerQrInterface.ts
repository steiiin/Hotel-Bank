import { createApp, h, reactive } from 'vue';
import { IonicVue } from '@ionic/vue';
import PlayerQrInterfaceComponent from '@/components/PlayerQrInterface.vue';

export type BankQrData = {
  type: string;
  [key: string]: unknown;
};

class PlayerQrInterfaceManager {
  private app: any = null;
  private container: HTMLElement | null = null;
  private state = reactive({
    isOpen: false,
    title: '',
    description: '',
  });

  show(title: string, description: string): Promise<BankQrData | null> {
    return new Promise((resolve) => {
      let hasSettled = false;

      this.destroy();

      this.container = document.createElement('div');
      document.body.appendChild(this.container);

      this.state.title = title;
      this.state.description = description;

      const settle = (result: BankQrData | null) => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        this.state.isOpen = false;
        resolve(result);
        this.destroy();
      };

      this.app = createApp({
        render: () => h(PlayerQrInterfaceComponent, {
          title: this.state.title,
          description: this.state.description,
          isOpen: this.state.isOpen,
          onScanned: (data: BankQrData) => settle(data),
          onCancel: () => settle(null),
          onDismiss: () => settle(null),
        }),
      });
      this.app.use(IonicVue);

      this.app.mount(this.container);
      this.state.isOpen = true;
    });
  }

  private destroy() {
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }

    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }

    this.state.isOpen = false;
    this.state.title = '';
    this.state.description = '';
  }
}

const playerQrInterface = new PlayerQrInterfaceManager();

export function usePlayerQrInterface() {
  return playerQrInterface;
}
