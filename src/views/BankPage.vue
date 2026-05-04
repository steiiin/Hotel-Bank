<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Bank</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Bank</ion-title>
        </ion-toolbar>
      </ion-header>

      <section v-if="activeTab === 'game'" class="tab-panel">
        <BankConfigPanel />
      </section>
      <section v-else-if="activeTab === 'bank'" class="tab-panel">
        <BankManagementPanel />
      </section>
      <section v-else class="tab-panel">
        <PlayerGamingPanel />
      </section>

    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <nav class="bottom-navigation">

          <ion-button fill="clear"
            :class="{ 'is-active': activeTab === 'game' }"
            @click="activeTab = 'game'">
            <ion-icon :icon="gameControllerOutline" />
            <ion-label>Spiel</ion-label>
          </ion-button>

          <ion-button fill="clear"
            :class="{ 'is-active': activeTab === 'bank' }"
            @click="activeTab = 'bank'">
            <ion-icon :icon="walletOutline" />
            <ion-label>Bank</ion-label>
          </ion-button>

          <ion-button fill="clear" v-if="bankIsPlayer"
            :class="{ 'is-active': activeTab === 'player' }"
            @click="activeTab = 'player'">
            <ion-icon :icon="personCircleOutline" />
            <ion-label>Spieler</ion-label>
          </ion-button>

        </nav>
      </ion-toolbar>
    </ion-footer>
  </ion-page>

</template>

<script setup lang="ts">

import { storeToRefs } from 'pinia';
import { IonButton, IonContent, IonFooter, IonHeader, IonIcon, IonLabel, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { gameControllerOutline, personCircleOutline, walletOutline } from 'ionicons/icons';
import { useGameStore } from '@/stores/game';
import { useHostGameSession } from '@/composables/useHostGameSession';
import { useWakeLock } from '@/composables/useWakeLock';
import BankConfigPanel from './panels/BankConfigPanel.vue';
import BankManagementPanel from './panels/BankManagementPanel.vue';
import PlayerGamingPanel from './panels/PlayerGamingPanel.vue';

const gameStore = useGameStore();
const {
  activeTab,
  bankIsPlayer,
  bankPlayerName,
  startingCapital,
  newPlayerName,
  players,
  displayBankPlayerName,
  formattedStartingCapital,
  playerBalances,
} = storeToRefs(gameStore);

const { addPlayer, removePlayer } = gameStore;
const { startHostPublishing } = useHostGameSession();

useWakeLock();
startHostPublishing();

</script>

<style scoped>

.tab-panel {
  display: block;
}

.bottom-navigation {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border-top: 1px solid var(--ion-color-step-150, #d7d8da);
}

.bottom-navigation ion-button {
  --color: var(--ion-color-medium);
  --padding-bottom: 0.5rem;
  --padding-top: 0.5rem;
  height: 3.5rem;
  margin: 0;
}

.bottom-navigation ion-button::part(native) {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bottom-navigation ion-button.is-active {
  --color: var(--ion-color-primary);
}

.bottom-navigation ion-icon {
  font-size: 1.35rem;
}

.bottom-navigation ion-label {
  font-size: 0.75rem;
}

ion-button[slot='end'] {
  margin-left: 0.75rem;
}

</style>
