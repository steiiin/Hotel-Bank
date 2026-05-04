<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button></ion-back-button>
        </ion-buttons>
        <ion-title>{{ titleLabel }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>

      <section class="player-page">

        <PlayerGamingPanel
          v-if="activePlayerSession"
          :player-name="activePlayerSession.name"
          :starting-capital="activePlayerSession.startingCapital"
          :balance="activePlayerSession.balance"
          :properties="activePlayerSession.properties"
        />

        <ion-list v-else inset>
          <ion-item>
            <ion-input ref="passwordInput"
              v-model="joinPassword"
              type="password"
              label="Passwort"
              label-placement="stacked"
              placeholder="Session-Passwort"
              @keyup.enter="joinHostSession"
            />
          </ion-item>
          <ion-button expand="block" class="scan-button" :disabled="!joinPassword.trim() || isJoining" @click="joinHostSession">
            Session suchen
          </ion-button>
          <ion-item v-if="availablePlayers.length">
            <ion-select
              v-model="selectedPlayerId"
              label="Spieler"
              label-placement="stacked"
              placeholder="Spieler auswählen"
            >
              <ion-select-option v-for="player in availablePlayers" :key="player.id" :value="player.id">
                {{ player.name }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-button
            v-if="availablePlayers.length"
            expand="block"
            class="scan-button"
            :disabled="!selectedPlayerId || isSelecting"
            @click="selectJoinedPlayer"
          >
            Spieler verbinden
          </ion-button>
        </ion-list>

        <ion-text v-if="activePlayerSession" color="medium">
          <p class="connection-status">
            {{ connectionLabel }}
            <span v-if="activePlayerSession.version"> · Version {{ activePlayerSession.version }}</span>
          </p>
        </ion-text>

        <ion-card v-if="scanError" color="danger">
          <ion-card-content>
            {{ scanError }}
          </ion-card-content>
        </ion-card>

      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  onIonViewWillLeave,
} from '@ionic/vue';
import { useGameStore } from '@/stores/game';
import { joinSession, selectPlayer, subscribeToPlayerUpdates, type PlayerSubscription } from '@/services/gameSessionApi';
import type { PublishedPlayerSummary, PlayerUpdate } from '@/services/sessionSnapshot';
import { useWakeLock } from '@/composables/useWakeLock';
import PlayerGamingPanel from './panels/PlayerGamingPanel.vue';

const gameStore = useGameStore();
const { activePlayerSession } = storeToRefs(gameStore);
const scanError = ref('');
const joinPassword = ref('');
const availablePlayers = ref<PublishedPlayerSummary[]>([]);
const selectedPlayerId = ref('');
const isJoining = ref(false);
const isSelecting = ref(false);
const connectionMode = ref<'sse' | 'poll' | null>(null);
const playerToken = ref('');
let subscription: PlayerSubscription | null = null;

useWakeLock();

const titleLabel = computed(() => activePlayerSession.value ? activePlayerSession.value.name : 'Spieler')
const connectionLabel = computed(() => {
  if (connectionMode.value === 'sse') {
    return 'Live verbunden';
  }
  if (connectionMode.value === 'poll') {
    return 'Verbunden';
  }
  return 'Verbunden';
});

const passwordInput = ref<any|null>(null)

function applyPlayerUpdate(update: PlayerUpdate) {
  gameStore.setActivePlayerSession({
    id: update.player.id,
    name: update.player.name,
    startingCapital: update.player.balance,
    balance: update.player.balance,
    properties: update.player.properties,
    version: update.version,
  });
  scanError.value = '';
}

async function joinHostSession() {
  if (!joinPassword.value.trim()) {
    return;
  }

  isJoining.value = true;
  scanError.value = '';

  try {
    const response = await joinSession(joinPassword.value);
    availablePlayers.value = response.players;
    selectedPlayerId.value = response.players.length === 1 ? response.players[0].id : '';
    if (!response.players.length) {
      scanError.value = 'Noch keine Spieler in der Host-Session.';
    }
  } catch (error) {
    availablePlayers.value = [];
    selectedPlayerId.value = '';
    scanError.value = 'Keine Session mit diesem Kennwort gefunden.';
  } finally {
    isJoining.value = false;
  }
}

async function selectJoinedPlayer() {
  if (!selectedPlayerId.value) {
    return;
  }

  isSelecting.value = true;
  scanError.value = '';

  try {
    const update = await selectPlayer(joinPassword.value, selectedPlayerId.value);
    playerToken.value = update.playerToken || '';
    applyPlayerUpdate(update);
    subscription?.close();
    subscription = subscribeToPlayerUpdates({
      playerId: selectedPlayerId.value,
      playerToken: playerToken.value,
      password: joinPassword.value,
      since: update.version,
      onUpdate: applyPlayerUpdate,
      onModeChange: (mode) => {
        connectionMode.value = mode;
      },
      onError: (error) => {
        scanError.value = error.message;
      },
    });
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : 'select-player-failed';
  } finally {
    isSelecting.value = false;
  }
}

function closePlayerConnection() {
  subscription?.close();
  subscription = null;
  playerToken.value = '';
  connectionMode.value = null;
  gameStore.clearActivePlayerSession();
}

onMounted(() => {
  setTimeout(() => {
    passwordInput.value?.$el.setFocus?.()
  }, 300)
});

onIonViewWillLeave(() => {
  closePlayerConnection();
});

onBeforeUnmount(() => {
  closePlayerConnection();
});
</script>

<style scoped>
.player-page {
  padding: 1rem 0;
}

.scan-button {
  margin: 1rem;
}

ion-text p {
  margin: 1rem;
}

.connection-status {
  font-size: 0.85rem;
}
</style>
