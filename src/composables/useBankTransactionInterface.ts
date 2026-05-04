import { createApp, h, reactive } from 'vue';
import { IonicVue } from '@ionic/vue';
import BankTransactionInterfaceComponent from '@/components/BankTransactionInterface.vue';

export interface BankTransactionResult {
  wasSuccessful: boolean;
  payload?: Record<string, any>;
}

class BankTransactionInterfaceManager {
  private app: any = null;
  private container: HTMLElement | null = null;
  private state = reactive({
    isOpen: false,
    title: '',
    payload: {} as Record<string, any>,
  });

  show(title: string, payload: Record<string, any>): Promise<BankTransactionResult> {
    return new Promise((resolve) => {
      let hasSettled = false;

      // Clean up any existing instance
      this.destroy();

      // Create container
      this.container = document.createElement('div');
      document.body.appendChild(this.container);

      // Set data
      this.state.title = title;
      this.state.payload = { ...payload };

      const settle = (result: BankTransactionResult) => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        this.state.isOpen = false;
        resolve(result);
        this.destroy();
      };

      // Create Vue app
      this.app = createApp({
        render: () => h(BankTransactionInterfaceComponent, {
          title: this.state.title,
          payload: this.state.payload,
          isOpen: this.state.isOpen,
          onConfirm: () => settle({ wasSuccessful: true, payload: this.state.payload }),
          onCancel: () => settle({ wasSuccessful: false }),
          onDismiss: (role: string) => settle({ wasSuccessful: role === 'confirm', payload: this.state.payload }),
        }),
      });
      this.app.use(IonicVue);

      // Mount the app
      this.app.mount(this.container);

      // Show the modal
      this.state.isOpen = true;
    });
  }

  private destroy() {
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
    this.state.isOpen = false;
    this.state.title = '';
    this.state.payload = {};
  }
}

export const BankTransactionInterface = new BankTransactionInterfaceManager();
