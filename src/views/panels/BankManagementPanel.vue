<template>
  <ion-card>
    <ion-card-content>
      <ion-list lines="none">
        <ion-item v-for="account in playerAccountOverviews" :key="account.id"
          @click="openPurchaseActions(account)" :detail="true" button>
          <ion-label>
            <h2>{{ account.name }}</h2>
            <p>{{ account.balance }}€</p>
            <p v-if="account.properties.length">{{ account.properties.join(', ') }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-card-content>
  </ion-card>

  <ion-card v-if="canOpenRentModal">
    <ion-card-content>
      <ion-button
        @click="showRentModal = true" expand="block" color="dark">Übernachten
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

  <ion-modal :is-open="showPurchaseActionSheet" @did-dismiss="hidePurchaseActionSheet">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ purchaseActionPlayer?.name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showPurchaseActionSheet=false">Abbrechen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="actions-grid single">
        <ion-card button color="danger"
          @click="queuePurchaseAction(() => passedBank())">
          <ion-card-content>
            <h2 style="color:#fff"><b>2000€</b> einziehen</h2>
          </ion-card-content>
        </ion-card>
      </div>
      <div class="actions-grid">
        <ion-card v-if="canPurchaseProperty"
          button
          @click="queuePurchaseAction(() => openPurchaseModal('property'))">
          <ion-card-content>
            <ion-img src="/assets/btn-kauf.png" />
            <h2>Grundstück kaufen</h2>
          </ion-card-content>
        </ion-card>
      </div>
      <div class="actions-grid">
        <ion-card v-if="canPurchaseImprovement"
          button
          @click="queuePurchaseAction(() => openPurchaseModal('improvement'))">
          <ion-card-content>
            <ion-img src="/assets/btn-ausbau.png" />
            <h2>Grundstück ausbauen</h2>
          </ion-card-content>
        </ion-card>
        <ion-card v-if="canPurchaseImprovement"
          button
          @click="queuePurchaseAction(() => openPurchaseModal('free-improvement'))">
          <ion-card-content>
            <ion-img src="/assets/btn-free-ausbau.png" />
            <h2>Kostenloser Ausbau</h2>
          </ion-card-content>
        </ion-card>
      </div>
      <div class="actions-grid single">
        <ion-card v-if="canPurchaseEntrance"
          button color="warning"
          @click="queuePurchaseAction(() => openPurchaseModal('entrances'))">
          <ion-card-content>
            <h2 style="color:#000"><b>Eingänge</b> kaufen</h2>
          </ion-card-content>
        </ion-card>
      </div>
      <div class="actions-grid">
        <ion-card v-if="canPurchaseEntrance"
          button
          @click="queuePurchaseAction(() => openPurchaseModal('free-entrance'))">
          <ion-card-content>
            <ion-img src="/assets/btn-free-entrance.png" />
            <h2>Kostenloser Eingang</h2>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-modal>

  <!-- <ion-action-sheet mode="ios"
    :is-open="showPurchaseActionSheet"
    :header="purchaseActionPlayer?.name"
    :buttons="purchaseActionButtons"
    @willDismiss="showPurchaseActionSheet = false"
    @didDismiss="hidePurchaseActionSheet"
  /> -->

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { IonActionSheet, IonCard, IonCardContent, IonButton, IonItem, IonLabel, IonList, IonModal, IonCardHeader, IonTitle, IonContent, IonHeader, IonToolbar, IonButtons, IonIcon, IonImg } from '@ionic/vue';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { properties, propertyKeys, type PropertyKey } from '@/data/properties';
import { useGameStore, type PlayerBalance, type PropertyOwnership } from '@/stores/game';
import type { Property } from '@/types';
import BankruptcyModal from '@/views/actions/BankruptcyModal.vue';
import FreeEntranceModal from '@/views/actions/FreeEntranceModal.vue';
import PurchaseEntrancesModal from '@/views/actions/PurchaseEntrancesModal.vue';
import PurchaseImprovementModal from '@/views/actions/PurchaseImprovementModal.vue';
import PurchasePropertyModal from '@/views/actions/PurchasePropertyModal.vue';
import RentModal from '@/views/actions/RentModal.vue';

const gameStore = useGameStore();
const { activeBankruptcySettlement, playerAccountOverviews, playerBalances, propertyOwnershipMap, propertyOwnerships } = storeToRefs(gameStore);
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
const canOpenRentModal = computed(() => propertyOwnerships.value.some((ownership) => (
  (ownership.entranceCount ?? 0) > 0 && hasFirstImprovement(ownership)
)));
const canPurchaseProperty = computed(() => {
  const player = purchaseActionPlayer.value;
  return Boolean(player && hasPurchasableProperty(player.id));
});
const canPurchaseImprovement = computed(() => {
  const player = purchaseActionPlayer.value;
  return Boolean(player && hasOpenImprovement(player.id));
});
const canPurchaseEntrance = computed(() => {
  const player = purchaseActionPlayer.value;
  return Boolean(player && hasOpenEntrance(player.id));
});

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

function hidePurchaseActionSheet() {
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

function hasPurchasableProperty(playerId: string) {
  return propertyKeys.some((propertyKey) => {
    const ownership = propertyOwnershipMap.value.get(propertyKey as PropertyKey);
    return !ownership || (ownership.ownerId !== playerId && !hasAnyImprovement(ownership));
  });
}

function hasOpenImprovement(playerId: string) {
  return propertyOwnerships.value.some((ownership) => (
    ownership.ownerId === playerId
    && hasUnboughtImprovement(ownership)
  ));
}

function hasOpenEntrance(playerId: string) {
  return propertyOwnerships.value.some((ownership) => {
    const property = properties[ownership.propertyKey];
    return Boolean(
      ownership.ownerId === playerId
      && hasFirstImprovement(ownership)
      && property
      && hasOpenEntranceSlot(property, ownership.entranceCount ?? 0)
    );
  });
}

function hasAnyImprovement(ownership: PropertyOwnership) {
  return ownership.boughtImprovements.some(Boolean);
}

function hasFirstImprovement(ownership: PropertyOwnership) {
  return ownership.boughtImprovements[0] === true;
}

function hasUnboughtImprovement(ownership: PropertyOwnership) {
  return ownership.boughtImprovements.some(isBought => !isBought);
}

function hasOpenEntranceSlot(property: Property, entranceCount: number) {
  return property.maxEntrances <= 0 || entranceCount < property.maxEntrances;
}

async function passedBank() {
  const player = purchaseActionPlayer.value;
  if (!player) return;
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

.actions-grid h2 {
  font-size: .9rem;
  text-transform: uppercase;
  text-align: center;
  color: #fff;
}

.actions-grid {
  display: flex;
}

.actions-grid ion-card {
  width: 156px;
  --background: #333;
}

.actions-gris ion-img {
  filter: contrast(1) brightness(1.4) opacity(.9);
  margin-bottom: 1rem;
}

.actions-grid.single ion-card {
  width: 100vw;
  flex: 1;
}

</style>
