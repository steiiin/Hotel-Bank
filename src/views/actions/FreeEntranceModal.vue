<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Kostenloser Eingang</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">Schließen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <ion-card v-if="!props.playerId">
        <ion-card-header>
          <ion-card-subtitle>Spieler</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-list v-if="visiblePlayers.length" lines="inset">
            <ion-item
              v-for="player in visiblePlayers"
              :key="player.id"
              button
              :detail="!selectedPlayer"
              @click="selectPlayer(player)"
            >
              <ion-label>
                <h2>{{ player.name }}</h2>
                <p>Kontostand: {{ player.balance }}</p>
              </ion-label>
              <ion-button
                v-if="selectedPlayer && playersWithProperties.length > 1"
                slot="end"
                fill="clear"
                color="medium"
                @click.stop="clearPlayer"
              >
                Wechseln
              </ion-button>
            </ion-item>
          </ion-list>
          <ion-note v-else color="medium">
            Kein Spieler besitzt Grundstücke.
          </ion-note>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="selectedPlayer">
        <ion-card-content>
          <ion-list v-if="propertyOptions.length" lines="none">
            <ion-item
              v-for="propertyOption in propertyOptions"
              :key="propertyOption.key"
              button
              @click="createFreeEntrance(propertyOption)"
            >
              <ion-label>
                <h2>{{ propertyOption.property.name }}</h2>
                <p>Eingänge: {{ propertyOption.entranceCount }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-note v-else color="medium">
            Keine Grundstücke verfügbar.
          </ion-note>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { properties, type PropertyKey } from '@/data/properties';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { useGameStore, type PlayerBalance } from '@/stores/game';
import type { Property } from '@/types';

type PropertyOption = {
  key: PropertyKey;
  property: Property;
  entranceCount: number;
};

const props = defineProps<{
  isOpen: boolean;
  playerId?: string | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const gameStore = useGameStore();
const { playerBalances, propertyOwnerships } = storeToRefs(gameStore);
const selectedPlayerId = ref<string | null>(null);

const playersWithProperties = computed<PlayerBalance[]>(() => (
  playerBalances.value.filter(player => playerOwnsProperty(player.id))
));

const selectedPlayer = computed(() => (
  playerBalances.value.find(player => player.id === (props.playerId ?? selectedPlayerId.value)) ?? null
));

const visiblePlayers = computed(() => (
  selectedPlayer.value ? [selectedPlayer.value] : playersWithProperties.value
));

const propertyOptions = computed<PropertyOption[]>(() => (
  selectedPlayer.value ? getPropertyOptions(selectedPlayer.value.id) : []
));

watch(playersWithProperties, (players) => {
  if (props.playerId) {
    return;
  }

  if (players.length === 1) {
    selectedPlayerId.value = players[0].id;
    return;
  }

  if (selectedPlayerId.value && !players.some(player => player.id === selectedPlayerId.value)) {
    selectedPlayerId.value = null;
  }
}, { immediate: true });

function selectPlayer(player: PlayerBalance) {
  selectedPlayerId.value = player.id;
}

function clearPlayer() {
  if (props.playerId) {
    return;
  }

  selectedPlayerId.value = null;
}

function close() {
  selectedPlayerId.value = playersWithProperties.value.length === 1 ? playersWithProperties.value[0].id : null;
  emit('close');
}

function getPropertyOptions(ownerId: string): PropertyOption[] {
  return propertyOwnerships.value.flatMap((ownership): PropertyOption[] => {
    if (ownership.ownerId !== ownerId || !hasFirstImprovement(ownership)) {
      return [];
    }

    const property = properties[ownership.propertyKey];
    if (!property) {
      return [];
    }

    const entranceCount = ownership.entranceCount ?? 0;
    if (!hasOpenEntranceSlot(property, entranceCount)) {
      return [];
    }

    return [{
      key: ownership.propertyKey,
      property,
      entranceCount,
    }];
  });
}

function playerOwnsProperty(ownerId: string) {
  return propertyOwnerships.value.some((ownership) => {
    const property = properties[ownership.propertyKey];
    return Boolean(
      ownership.ownerId === ownerId
      && hasFirstImprovement(ownership)
      && property
      && hasOpenEntranceSlot(property, ownership.entranceCount ?? 0),
    );
  });
}

function hasFirstImprovement(ownership: { boughtImprovements: boolean[] }) {
  return ownership.boughtImprovements[0] === true;
}

function hasOpenEntranceSlot(property: Property, entranceCount: number) {
  return property.maxEntrances <= 0 || entranceCount < property.maxEntrances;
}

async function createFreeEntrance(propertyOption: PropertyOption) {
  const player = selectedPlayer.value;
  if (!player) {
    return;
  }

  const payload = {
    type: 'free-entrance',
    player: player.name,
    entrances: [
      {
        propertyKey: propertyOption.key,
        price: 0,
      },
    ],
    sumPrice: 0,
    balanceAfter: player.balance,
  };

  const bankTransaction = await BankTransactionInterface.show('Kostenloser Eingang', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.recordCompletedTransaction();
  gameStore.addEntrance(propertyOption.key, player.id);
  close();
}
</script>
