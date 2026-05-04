<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Übernachtung</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">Schließen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <template v-if="!selectedGuest">
        <ion-card>
          <ion-card-header>
            <ion-card-subtitle>Hotel</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="visibleProperties.length" lines="none">
              <ion-item
                v-for="propertyOption in visibleProperties"
                :key="propertyOption.key"
                button
                :detail="!selectedPropertyOption"
                @click="selectProperty(propertyOption)"
              >
                <ion-label>
                  <h2>{{ propertyOption.property.name }} - (<b>{{ propertyOption.owner.name }}</b>)</h2>
                  <property-stars :stars="propertyOption.latestImprovement.stars"></property-stars>
                  <h3></h3>
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
              Keine Hotels mit Eingang und Hauptgebäude verfügbar.
            </ion-note>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="selectedPropertyOption">
          <ion-card-header>
            <ion-card-subtitle>Gast</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="guestOptions.length" lines="none">
              <ion-item
                v-for="guest in guestOptions"
                :key="guest.id"
                button
                detail
                @click="selectGuest(guest)"
              >
                <ion-label>
                  <h2>{{ guest.name }}</h2>
                  <p>Kontostand: {{ guest.balance }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <ion-note v-else color="medium">
              Kein Gast verfügbar.
            </ion-note>
          </ion-card-content>
        </ion-card>
      </template>

      <template v-else-if="selectedHost && selectedPropertyOption">
        <ion-card>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>Hotelbesitzer</ion-label>
                <ion-note slot="end"><h1>{{ selectedHost.name }}</h1></ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Hotel</ion-label>
                <ion-note slot="end"><h2>{{ selectedPropertyOption.property.name }}</h2></ion-note>
              </ion-item>
              <ion-item>
                <ion-label>Gast</ion-label>
                <ion-note slot="end"><h2>{{ selectedGuest.name }}</h2></ion-note>
              </ion-item>
            </ion-list>

            <ion-button fill="clear" color="primary" @click="clearGuest">
              Auswahl ändern
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-content>
            <div class="night-actions">
              <ion-button
                v-for="night in nights"
                :key="night"
                size="small"
                :color="night<3 ? 'success' : night>4 ? 'danger' : 'warning'"
                :disabled="!canRent(night)"
                @click="rent(night)"
              >
                {{ night }}
              </ion-button>
            </div>
            <ion-note v-if="!canRentAnyNight" color="danger">
              Keine Übernachtung möglich.
            </ion-note>
          </ion-card-content>
        </ion-card>
      </template>
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
import { useGameStore, type PlayerBalance, type PropertyOwnership } from '@/stores/game';
import type { Property, PropertyImprovement } from '@/types';
import PropertyStars from '@/components/PropertyStars.vue';

type PropertyOption = {
  key: PropertyKey;
  property: Property;
  owner: PlayerBalance;
  latestImprovement: PropertyImprovement;
  entranceCount: number;
};

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const gameStore = useGameStore();
const { playerBalances, propertyOwnerships } = storeToRefs(gameStore);
const selectedPropertyKey = ref<PropertyKey | null>(null);
const selectedGuestId = ref<string | null>(null);
const nights = [1, 2, 3, 4, 5, 6];

const propertyOptions = computed<PropertyOption[]>(() => getRentablePropertyOptions());

const selectedPropertyOption = computed(() => (
  propertyOptions.value.find(propertyOption => propertyOption.key === selectedPropertyKey.value) ?? null
));

const selectedHost = computed(() => (
  selectedPropertyOption.value?.owner ?? null
));

const selectedGuest = computed(() => (
  playerBalances.value.find(player => player.id === selectedGuestId.value) ?? null
));

const visibleProperties = computed(() => (
  selectedPropertyOption.value ? [selectedPropertyOption.value] : propertyOptions.value
));

const guestOptions = computed(() => (
  selectedPropertyOption.value
    ? playerBalances.value.filter(player => player.id !== selectedPropertyOption.value?.owner.id)
    : []
));

const canRentAnyNight = computed(() => (
  nights.some(night => canRent(night))
));

watch(propertyOptions, (options) => {
  if (options.length === 1) {
    selectedPropertyKey.value = options[0].key;
    return;
  }

  if (selectedPropertyKey.value && !options.some(option => option.key === selectedPropertyKey.value)) {
    selectedPropertyKey.value = null;
  }
}, { immediate: true });

watch(selectedPropertyKey, () => {
  selectedGuestId.value = null;
});

watch(guestOptions, (guests) => {
  if (selectedGuestId.value && !guests.some(guest => guest.id === selectedGuestId.value)) {
    selectedGuestId.value = null;
  }
});

function selectProperty(propertyOption: PropertyOption) {
  selectedPropertyKey.value = propertyOption.key;
}

function clearProperty() {
  selectedPropertyKey.value = null;
  selectedGuestId.value = null;
}

function selectGuest(guest: PlayerBalance) {
  selectedGuestId.value = guest.id;
}

function clearGuest() {
  selectedGuestId.value = null;
}

function close() {
  selectedPropertyKey.value = null;
  selectedGuestId.value = null;
  emit('close');
}

function getRentablePropertyOptions(): PropertyOption[] {
  return propertyOwnerships.value.flatMap((ownership): PropertyOption[] => {
    if ((ownership.entranceCount ?? 0) < 1 || !ownership.boughtImprovements[0]) {
      return [];
    }

    const property = properties[ownership.propertyKey];
    const owner = playerBalances.value.find(player => player.id === ownership.ownerId);
    const latestImprovement = getLatestImprovement(ownership);

    if (!property || !owner || !latestImprovement) {
      return [];
    }

    return [{
      key: ownership.propertyKey,
      property,
      owner,
      latestImprovement,
      entranceCount: ownership.entranceCount ?? 0,
    }];
  });
}

function getLatestImprovement(ownership: PropertyOwnership) {
  const property = properties[ownership.propertyKey];
  if (!property) {
    return null;
  }

  const latestImprovementIndex = ownership.boughtImprovements.reduce((latestIndex, isBought, index) => (
    isBought ? index : latestIndex
  ), -1);

  return property.improvements[latestImprovementIndex] ?? null;
}

function getPrice(night: number) {
  return selectedPropertyOption.value?.latestImprovement.cost[night - 1] ?? 0;
}

function canRent(night: number) {
  return Boolean(selectedGuest.value && getPrice(night) > 0);
}

async function rent(night: number) {
  const host = selectedHost.value;
  const guest = selectedGuest.value;
  const propertyOption = selectedPropertyOption.value;

  if (!host || !guest || !propertyOption || !canRent(night)) {
    return;
  }

  const price = getPrice(night);
  const balanceAfterHost = host.balance + price;
  const balanceAfterGuest = guest.balance - price;
  const payload = {
    type: 'rent',
    host: host.name,
    guest: guest.name,
    propertyKey: propertyOption.key,
    propertyStars: propertyOption.latestImprovement.stars,
    nights: night,
    price,
    balanceAfterHost,
    balanceAfterGuest,
  };

  const bankTransaction = await BankTransactionInterface.show('Übernachtung', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.recordCompletedTransaction();

  if (guest.balance >= price) {
    gameStore.updatePlayerBalance(host.id, balanceAfterHost);
    gameStore.updatePlayerBalance(guest.id, balanceAfterGuest);
  } else {
    gameStore.startBankruptcySettlement({
      debtorId: guest.id,
      creditor: { type: 'player', playerId: host.id },
      owedAmount: price,
      debtorStartingBalance: guest.balance,
      sourceActionLabel: 'Übernachtung',
    });
  }

  close();
}
</script>

<style scoped>
.night-actions {
  display: grid;
  grid-template-columns: repeat(6, minmax(2.5rem, 1fr));
  gap: 0.5rem;
}
</style>
