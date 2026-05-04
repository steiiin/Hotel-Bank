<template>
  <ion-card>
    <ion-card-content>
      <ion-list lines="none">
        <ion-item v-for="account in playerBalances" :key="account.id"
          @click="openPurchaseActions(account)" :detail="true" button>
          <ion-label>
            <h2>{{ account.name }}</h2>
            <p>{{ account.balance }}€</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-card-content>
  </ion-card>

  <ion-card>
    <ion-card-content>
      <ion-button
        @click="showRentModal = true" expand="block">Übernachten
      </ion-button>
    </ion-card-content>
  </ion-card>

  <PurchasePropertyModal
    :is-open="showPurchasePropertyModal"
    :player-id="purchaseActionPlayerId"
    @close="showPurchasePropertyModal = false"
  />
  <PurchaseImprovementModal
    :is-open="showPurchaseImprovementModal"
    :player-id="purchaseActionPlayerId"
    @close="showPurchaseImprovementModal = false"
  />
  <PurchaseImprovementModal
    :is-open="showFreeImprovementModal"
    :player-id="purchaseActionPlayerId"
    free-only
    @close="showFreeImprovementModal = false"
  />
  <PurchaseEntrancesModal
    :is-open="showPurchaseEntrancesModal"
    :player-id="purchaseActionPlayerId"
    @close="showPurchaseEntrancesModal = false"
  />
  <FreeEntranceModal
    :is-open="showFreeEntranceModal"
    :player-id="purchaseActionPlayerId"
    @close="showFreeEntranceModal = false"
  />
  <RentModal
    :is-open="showRentModal"
    @close="showRentModal = false"
  />
  <BankruptcyModal
    :is-open="Boolean(activeBankruptcySettlement)"
    @resolved="closeAllActionModals"
  />

  <ion-action-sheet mode="ios"
    :is-open="showPurchaseActionSheet"
    :header="purchaseActionPlayer?.name"
    :buttons="purchaseActionButtons"
    @willDismiss="showPurchaseActionSheet = false"
    @didDismiss="handlePurchaseActionSheetDismiss"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { IonActionSheet, IonCard, IonCardContent, IonButton, IonItem, IonLabel, IonList } from '@ionic/vue';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { useGameStore, type PlayerBalance } from '@/stores/game';
import BankruptcyModal from '@/views/actions/BankruptcyModal.vue';
import FreeEntranceModal from '@/views/actions/FreeEntranceModal.vue';
import PurchaseEntrancesModal from '@/views/actions/PurchaseEntrancesModal.vue';
import PurchaseImprovementModal from '@/views/actions/PurchaseImprovementModal.vue';
import PurchasePropertyModal from '@/views/actions/PurchasePropertyModal.vue';
import RentModal from '@/views/actions/RentModal.vue';

const gameStore = useGameStore();
const { activeBankruptcySettlement, playerBalances } = storeToRefs(gameStore);
const showFreeEntranceModal = ref(false);
const showFreeImprovementModal = ref(false);
const showPurchaseEntrancesModal = ref(false);
const showPurchaseImprovementModal = ref(false);
const showPurchasePropertyModal = ref(false);
const showPurchaseActionSheet = ref(false);
const showRentModal = ref(false);
const purchaseActionPlayerId = ref<string | null>(null);
const queuedPurchaseAction = ref<(() => void | Promise<void>) | null>(null);
const purchaseActionPlayer = computed(() => (
  playerBalances.value.find(player => player.id === purchaseActionPlayerId.value) ?? null
));

const purchaseActionButtons = computed(() => [
  {
    text: '2000€ einziehen',
    handler: () => {
      const player = purchaseActionPlayer.value;
      if (!player) return;
      queuePurchaseAction(() => passedBank(player));
    },
  },
  {
    text: '',
    cssClass: 'purchase-action-divider',
    disabled: true,
  },
  {
    text: 'Grundstückskauf',
    handler: () => queuePurchaseAction(() => openPurchaseModal('property')),
  },
  {
    text: '',
    cssClass: 'purchase-action-divider',
    disabled: true,
  },
  {
    text: 'Grundstücksausbau',
    handler: () => queuePurchaseAction(() => openPurchaseModal('improvement')),
  },
  {
    text: 'Kostenloser Ausbau',
    handler: () => queuePurchaseAction(() => openPurchaseModal('free-improvement')),
  },
  {
    text: '',
    cssClass: 'purchase-action-divider',
    disabled: true,
  },
  {
    text: 'Eingänge',
    handler: () => queuePurchaseAction(() => openPurchaseModal('entrances')),
  },
  {
    text: 'Kostenloser Eingang',
    handler: () => queuePurchaseAction(() => openPurchaseModal('free-entrance')),
  },
  {
    text: 'Abbrechen',
    role: 'cancel',
  },
]);

type PurchaseAction = 'property' | 'improvement' | 'free-improvement' | 'entrances' | 'free-entrance';

function openPurchaseActions(player: PlayerBalance) {
  queuedPurchaseAction.value = null;
  purchaseActionPlayerId.value = player.id;
  showPurchaseActionSheet.value = true;
}

function queuePurchaseAction(action: () => void | Promise<void>) {
  queuedPurchaseAction.value = action;
  showPurchaseActionSheet.value = false;
}

function handlePurchaseActionSheetDismiss() {
  showPurchaseActionSheet.value = false;

  const action = queuedPurchaseAction.value;
  queuedPurchaseAction.value = null;
  void action?.();
}

function openPurchaseModal(action: PurchaseAction) {
  showPurchasePropertyModal.value = action === 'property';
  showPurchaseImprovementModal.value = action === 'improvement';
  showFreeImprovementModal.value = action === 'free-improvement';
  showPurchaseEntrancesModal.value = action === 'entrances';
  showFreeEntranceModal.value = action === 'free-entrance';
}

async function passedBank(player: PlayerBalance) {
  const balanceAfter = player.balance + 2000;
  const payload = {
    type: 'passed-bank',
    player: player.name,
    balanceAfter,
  };

  const bankTransaction = await BankTransactionInterface.show('Bank passiert', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.updatePlayerBalance(player.id, balanceAfter);
  gameStore.recordCompletedTransaction();
}

function closeAllActionModals() {
  showFreeEntranceModal.value = false;
  showFreeImprovementModal.value = false;
  showPurchaseEntrancesModal.value = false;
  showPurchaseImprovementModal.value = false;
  showPurchasePropertyModal.value = false;
  showPurchaseActionSheet.value = false;
  showRentModal.value = false;
  queuedPurchaseAction.value = null;
  purchaseActionPlayerId.value = null;
}
</script>

<style scoped>
.player-actions {
  display: grid;
  gap: 0.125rem;
}

.player-actions ion-button {
  margin: 0;
}

:global(.purchase-action-divider) {
  border-top: 3px solid var(--ion-color-step-200, #d7d8da) !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  pointer-events: none;
}
</style>
