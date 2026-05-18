<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Grundstücksausbau</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">Schließen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <ion-card v-if="!props.playerId">
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
            Kein Spieler besitzt ausbaubare Grundstücke.
          </ion-note>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="selectedPlayer">
        <ion-card-content>
          <ion-list v-if="visibleProperties.length" lines="none">
            <ion-item v-for="propertyOption in visibleProperties" :key="propertyOption.key"
              button :detail="!selectedPropertyOption"
              @click="selectProperty(propertyOption)">
              <ion-label>
                <h2>{{ propertyOption.property.name }}</h2>
                <p>
                  <b>Nächster Ausbau:</b> {{ propertyOption.nextImprovement.name }}<br>
                  <b>Preis:</b> {{ propertyOption.nextImprovement.price }}€
                </p>
              </ion-label>
              <ion-button
                v-if="selectedPropertyOption && propertyOptions.length > 1"
                slot="end"
                fill="clear"
                color="medium"
                @click.stop="clearProperty"
              >
                Wechseln
              </ion-button>
            </ion-item>
          </ion-list>
          <ion-note v-else color="medium">
            Keine ausbaubaren Grundstücke verfügbar.
          </ion-note>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="selectedPropertyOption">
        <card-colored-header title="Nächster Ausbau"></card-colored-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-label>
                <h2>{{ selectedPropertyOption.nextImprovement.name }}</h2>
                <p>Grundstück: {{ selectedPropertyOption.property.name }}</p>
                <p>Sterne: {{ selectedPropertyOption.nextImprovement.stars }}</p>
                <p>Preis: {{ selectedPropertyOption.nextImprovement.price }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <div class="permit-actions">
            <ion-button
              v-if="!freeOnly"
              color="warning"
              @click="purchase('NORMAL')"
            >
              Normalpreis
            </ion-button>
            <ion-button color="success" @click="purchase('FREE')">
              Kostenlos
            </ion-button>
            <ion-button
              v-if="!freeOnly"
              color="danger"
              @click="purchase('DOUBLE')"
            >
              Doppelter Preis
            </ion-button>
          </div>
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
import type { Property, PropertyImprovement } from '@/types';
import CardColoredHeader from '@/components/CardColoredHeader.vue';

type Permit = 'NORMAL' | 'FREE' | 'DOUBLE';

type PropertyOption = {
  key: PropertyKey;
  property: Property;
  nextImprovement: PropertyImprovement;
  nextImprovementIndex: number;
};

const props = defineProps<{
  isOpen: boolean;
  freeOnly?: boolean;
  playerId?: string | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const gameStore = useGameStore();
const { playerBalances, propertyOwnerships } = storeToRefs(gameStore);
const selectedPlayerId = ref<string | null>(null);
const selectedPropertyKey = ref<PropertyKey | null>(null);

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
  selectedPlayer.value ? getOpenPropertyOptions(selectedPlayer.value.id) : []
));

const selectedPropertyOption = computed(() => (
  propertyOptions.value.find(propertyOption => propertyOption.key === selectedPropertyKey.value) ?? null
));

const visibleProperties = computed(() => (
  selectedPropertyOption.value ? [selectedPropertyOption.value] : propertyOptions.value
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

watch(propertyOptions, (options) => {
  if (!selectedPlayer.value) {
    selectedPropertyKey.value = null;
    return;
  }

  if (options.length === 1) {
    selectedPropertyKey.value = options[0].key;
    return;
  }

  if (selectedPropertyKey.value && !options.some(option => option.key === selectedPropertyKey.value)) {
    selectedPropertyKey.value = null;
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
  selectedPropertyKey.value = null;
}

function selectProperty(propertyOption: PropertyOption) {
  selectedPropertyKey.value = propertyOption.key;
}

function clearProperty() {
  selectedPropertyKey.value = null;
}

function close() {
  selectedPlayerId.value = null;
  selectedPropertyKey.value = null;
  emit('close');
}

function getOpenPropertyOptions(ownerId: string): PropertyOption[] {
  return propertyOwnerships.value.flatMap((ownership): PropertyOption[] => {
    if (ownership.ownerId !== ownerId) {
      return [];
    }

    const property = properties[ownership.propertyKey];
    const nextImprovementIndex = ownership.boughtImprovements.findIndex(isBought => !isBought);
    const nextImprovement = property?.improvements[nextImprovementIndex];

    if (!property || nextImprovementIndex === -1 || !nextImprovement) {
      return [];
    }

    return [{
      key: ownership.propertyKey,
      property,
      nextImprovement,
      nextImprovementIndex,
    }];
  });
}

function playerOwnsProperty(ownerId: string) {
  return propertyOwnerships.value.some(ownership => ownership.ownerId === ownerId);
}

function getPermitPrice(permit: Permit, price: number) {
  if (permit === 'FREE') {
    return 0;
  }

  if (permit === 'DOUBLE') {
    return price * 2;
  }

  return price;
}

async function purchase(permit: Permit) {
  const player = selectedPlayer.value;
  const propertyOption = selectedPropertyOption.value;

  if (!player || !propertyOption) {
    return;
  }

  const price = getPermitPrice(permit, propertyOption.nextImprovement.price);
  const balanceAfter = player.balance - price;
  const payload = {
    type: 'purchase-improvement',
    player: player.name,
    price,
    permit,
    propertyKey: propertyOption.key,
    improvementIndex: propertyOption.nextImprovementIndex,
    balanceAfter,
  };

  const bankTransaction = await BankTransactionInterface.show('Grundstücksausbau', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.recordCompletedTransaction();
  gameStore.buyImprovement(propertyOption.key, propertyOption.nextImprovementIndex);

  if (player.balance >= price) {
    gameStore.updatePlayerBalance(player.id, balanceAfter);
  } else {
    gameStore.startBankruptcySettlement({
      debtorId: player.id,
      creditor: { type: 'bank' },
      owedAmount: price,
      debtorStartingBalance: player.balance,
      sourceActionLabel: 'Grundstücksausbau',
    });
  }

  close();
}
</script>

<style scoped>
.permit-actions {
  display: grid;
  gap: 0.75rem;
}
</style>
