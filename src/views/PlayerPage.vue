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
        <WakeLockPrompt
          :show="showWakeLockPrompt"
          :isActivating="wakeLockActivating"
          @activate="activateWakeLock"
        />

        <template v-if="activePlayerSession">
          <PlayerGamingPanel
            :player-name="activePlayerSession.name"
            :starting-capital="activePlayerSession.startingCapital"
            :balance="activePlayerSession.balance"
            :properties="activePlayerSession.properties"
          />

          <section v-if="otherPlayerOverviews.length" class="player-overviews" aria-label="Andere Spieler">
            <h2>Andere Spieler</h2>
            <ion-card v-for="player in otherPlayerOverviews" :key="player.id">
              <ion-card-content>
                <h3>{{ player.name }}</h3>
                <ion-list v-if="player.properties.length" lines="none">
                  <ion-item v-for="property in player.properties" :key="property.key">
                    <ion-label>
                      <div v-if="property.latestImprovement" class="small-props">
                        <h4>{{ property.name }}</h4>
                        <PropertyStars :stars="property.latestImprovement.stars" />
                      </div>
                      <div v-else class="small-props">
                        <h4>{{ property.name }}</h4>
                        <p><b>Unbebaut</b></p>
                      </div>
                    </ion-label>
                  </ion-item>
                </ion-list>
                <p v-else class="empty-properties">Noch keine Grundstücke</p>
              </ion-card-content>
            </ion-card>
          </section>
        </template>

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

        <ion-toast
          :is-open="toastOpen"
          :message="toastMessage"
          :color="toastColor"
          duration="2000"
          @didDismiss="toastOpen = false"
        />

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
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
  onIonViewWillLeave,
} from '@ionic/vue';
import { useGameStore } from '@/stores/game';
import { joinSession, selectPlayer, subscribeToPlayerUpdates, type PlayerSubscription } from '@/services/gameSessionApi';
import type { PublishedPlayer, PublishedPlayerProperty, PublishedPlayerSummary, PlayerUpdate } from '@/services/sessionSnapshot';
import { useWakeLock } from '@/composables/useWakeLock';
import { properties as hotelProperties, type PropertyKey } from '@/data/properties';
import type { PropertyImprovement } from '@/types';
import PropertyStars from '@/components/PropertyStars.vue';
import PlayerGamingPanel from './panels/PlayerGamingPanel.vue';
import WakeLockPrompt from '@/components/WakeLockPrompt.vue';

type VisibleOverviewProperty = PublishedPlayerProperty & {
  latestImprovement: PropertyImprovement | null;
};

type PlayerOverview = Omit<PublishedPlayer, 'properties' | 'balance'> & {
  properties: VisibleOverviewProperty[];
};

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
const wakeLockActivating = ref(false);
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
let subscription: PlayerSubscription | null = null;

const {
  requestWakeLock,
  isSupported: wakeLockSupported,
  isActive: wakeLockActive,
} = useWakeLock();

const showWakeLockPrompt = computed(() => wakeLockSupported.value && !wakeLockActive.value);

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
const otherPlayerOverviews = computed<PlayerOverview[]>(() => (
  (activePlayerSession.value?.players ?? [])
    .filter(player => player.id !== activePlayerSession.value?.id)
    .map(player => ({
      id: player.id,
      name: player.name,
      properties: player.properties.map(toVisibleOverviewProperty),
    }))
));

const passwordInput = ref<any|null>(null)

function applyPlayerUpdate(update: PlayerUpdate) {
  gameStore.setActivePlayerSession({
    id: update.player.id,
    name: update.player.name,
    startingCapital: update.player.balance,
    balance: update.player.balance,
    properties: update.player.properties,
    players: update.players,
    version: update.version,
  });
  scanError.value = '';
}

function toVisibleOverviewProperty(property: PublishedPlayerProperty): VisibleOverviewProperty {
  return {
    ...property,
    latestImprovement: getLatestImprovement(property),
  };
}

function getLatestImprovement(property: { key: string; boughtImprovements: boolean[] }) {
  const improvementIndex = property.boughtImprovements.findLastIndex(Boolean);

  if (improvementIndex === -1) {
    return null;
  }

  return hotelProperties[property.key as PropertyKey]?.improvements[improvementIndex] ?? null;
}

function formatEntranceCount(entranceCount: number) {
  return `${entranceCount} Eingang${entranceCount === 1 ? '' : 'e'}`;
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
      sessionId: update.sessionId,
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

async function activateWakeLock() {
  wakeLockActivating.value = true;
  const success = await requestWakeLock();
  wakeLockActivating.value = false;

  toastMessage.value = success
    ? 'Bildschirmsperre aktiviert.'
    : 'Bildschirmsperre konnte nicht aktiviert werden.';
  toastColor.value = success ? 'success' : 'danger';
  toastOpen.value = true;
}

onMounted(() => {
  setTimeout(() => {
    passwordInput.value?.$el.setFocus?.();
  }, 300);
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

.player-overviews {
  margin: 1.5rem 0 0;
}

.player-overviews > h2 {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 1rem 0.5rem;
}

.player-overviews h3 {
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
}

.player-overviews h4 {
  font-size: 1rem;
}

.player-overviews ion-list {
  margin: 0 -1rem -1rem;
}

.empty-properties {
  color: var(--ion-color-medium);
  margin: 0;
}

.small-props {
  display: flex;
  gap: .5rem;
}


</style>
