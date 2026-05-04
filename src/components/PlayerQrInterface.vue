<template>
  <ion-modal :is-open="isOpen" @didPresent="startScanner" @willDismiss="stopScanner" @didDismiss="handleDismiss">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="cancel">Abbrechen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="scan-content">
        <p>{{ description }}</p>

        <div class="scanner-frame">
          <div :id="scannerElementId" class="scanner-reader" />
          <div v-if="scannerMessage" class="scanner-message">{{ scannerMessage }}</div>
        </div>

        <ion-textarea
          v-model="manualQrValue"
          auto-grow
          label="QR-Wert"
          label-placement="stacked"
          placeholder='{"type":"add-player","player":"Alice","startingCapital":15000}'
        />

        <ion-text v-if="scanError" color="danger">
          <p>{{ scanError }}</p>
        </ion-text>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button @click="checkManualValue">QR-Wert prüfen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonTextarea,
  IonText,
} from '@ionic/vue';
import type { BankQrData } from '@/composables/usePlayerQrInterface';

interface Props {
  title: string;
  description: string;
  isOpen: boolean;
}

interface Emits {
  (e: 'scanned', data: BankQrData): void;
  (e: 'cancel'): void;
  (e: 'dismiss', role: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const scannerElementId = `player-qr-reader-${Math.random().toString(36).slice(2)}`;
const manualQrValue = ref('');
const scanError = ref('');
const scannerMessage = ref('Kamera wird vorbereitet...');

let scanner: Html5Qrcode | null = null;
let hasSettled = false;

function parseBankQrData(value: string): BankQrData | null {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }

    return parsed as BankQrData;
  } catch {
    return null;
  }
}

function completeScan(data: BankQrData) {
  if (hasSettled) {
    return;
  }

  hasSettled = true;
  scanError.value = '';
  void stopScanner();
  emit('scanned', data);
}

async function startScanner() {
  hasSettled = false;
  scanError.value = '';
  scannerMessage.value = 'Kamera wird vorbereitet...';
  await nextTick();

  try {
    scanner = new Html5Qrcode(scannerElementId, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
    });

    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return { width: edge, height: edge };
        },
      },
      (decodedText) => {
        const data = parseBankQrData(decodedText);

        if (data) {
          completeScan(data);
          return;
        }

        scanError.value = 'Der QR-Code enthält keine gültigen Bankdaten.';
      },
      () => {
        scanError.value = '';
      },
    );

    scannerMessage.value = '';
  } catch {
    await stopScanner();
    scannerMessage.value = 'Kamera konnte nicht geöffnet werden.';
  }
}

async function stopScanner() {
  if (!scanner) {
    return;
  }

  const currentScanner = scanner;
  scanner = null;

  try {
    if (currentScanner.isScanning) {
      await currentScanner.stop();
    }
  } catch {
    // Scanner may already be stopped while Ionic is dismissing the modal.
  } finally {
    currentScanner.clear();
  }
}

function checkManualValue() {
  const data = parseBankQrData(manualQrValue.value.trim());

  if (!data) {
    scanError.value = 'Bitte einen gültigen Bank-QR-Wert mit type einfügen.';
    return;
  }

  completeScan(data);
}

function cancel() {
  void stopScanner();
  emit('cancel');
}

function handleDismiss(event: CustomEvent) {
  void stopScanner();
  emit('dismiss', event?.detail?.role || 'cancel');
}
</script>

<style scoped>
.scan-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scanner-frame {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-250, #c8c7cc);
  border-radius: 8px;
  background: var(--ion-color-step-100, #f2f2f2);
}

.scanner-reader {
  width: 100%;
}

.scanner-reader :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-reader :deep(img) {
  max-width: 100%;
}

.scanner-message {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.86);
  color: var(--ion-color-medium);
}
</style>
