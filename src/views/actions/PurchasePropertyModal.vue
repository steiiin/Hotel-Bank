<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Grundstückskauf</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">Schließen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <ion-card v-if="selectedPlayer" with-header>
        <card-colored-header title="Grundstücke"></card-colored-header>
        <ion-card-content>
          <ion-list v-if="availableProperties.length" lines="none">
            <ion-item v-for="propertyOption in availableProperties" :key="propertyOption.key">
              <ion-label>
                <h2>{{ propertyOption.property.name }}</h2>
                <p>
                  {{ propertyOption.label }}:
                  {{ propertyOption.price }}
                </p>
                <p v-if="propertyOption.ownerName">
                  Besitzer: {{ propertyOption.ownerName }}
                </p>
              </ion-label>

              <ion-button
                slot="end"
                color="success"
                :disabled="!canPurchase(propertyOption.price)"
                @click="purchase(propertyOption)"
              >
                Kaufen
              </ion-button>
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
import { computed, ref } from 'vue';
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
import { properties, propertyKeys, type PropertyKey } from '@/data/properties';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { useGameStore, type PlayerBalance } from '@/stores/game';
import type { Property } from '@/types';
import CardColoredHeader from '@/components/CardColoredHeader.vue';

type PropertyOption = {
  key: PropertyKey;
  property: Property;
  price: number;
  label: 'Kauf' | 'Zwangsversteigerung';
  isForclosure: boolean;
  ownerName: string;
  previousOwnerId?: string;
};

const props = defineProps<{
  isOpen: boolean;
  playerId?: string | null;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const gameStore = useGameStore();
const { playerBalances, propertyOwnershipMap } = storeToRefs(gameStore);
const selectedPlayerId = ref<string | null>(null);

const selectedPlayer = computed(() => (
  playerBalances.value.find(player => player.id === (props.playerId ?? selectedPlayerId.value)) ?? null
));

const visiblePlayers = computed(() => (
  selectedPlayer.value ? [selectedPlayer.value] : playerBalances.value
));

const availableProperties = computed<PropertyOption[]>(() => {
  if (!selectedPlayer.value) {
    return [];
  }

  return propertyKeys.flatMap((propertyKey): PropertyOption[] => {
    const key = propertyKey as PropertyKey;
    const property = properties[key];
    const ownership = propertyOwnershipMap.value.get(key);

    if (ownership?.ownerId === selectedPlayer.value?.id) {
      return [];
    }

    if (!ownership) {
      return [{
        key,
        property,
        price: property.price,
        label: 'Kauf',
        isForclosure: false,
        ownerName: '',
      }];
    }

    if (ownership.boughtImprovements.some(Boolean)) {
      return [];
    }

    return [{
      key,
      property,
      price: property.forclosurePrice,
      label: 'Zwangsversteigerung',
      isForclosure: true,
      ownerName: getOwnerName(ownership.ownerId),
      previousOwnerId: ownership.ownerId,
    }];
  });
});

function selectPlayer(player: PlayerBalance) {
  selectedPlayerId.value = player.id;
}

function clearPlayer() {
  if (props.playerId) {
    return;
  }

  selectedPlayerId.value = null;
}

function canPurchase(price: number) {
  return Boolean(selectedPlayer.value && selectedPlayer.value.balance >= price);
}

function close() {
  selectedPlayerId.value = null;
  emit('close');
}

async function purchase(propertyOption: PropertyOption) {
  const player = selectedPlayer.value;
  if (!player || !canPurchase(propertyOption.price)) {
    return;
  }

  const balanceAfter = player.balance - propertyOption.price;
  let payload;
  let previousOwnerBalanceAfter = 0;

  if (propertyOption.isForclosure && propertyOption.previousOwnerId) {
    const previousOwner = playerBalances.value.find(account => account.id === propertyOption.previousOwnerId);
    previousOwnerBalanceAfter = previousOwner ? previousOwner.balance + propertyOption.price : propertyOption.price;
    payload = {
      type: 'purchase-property-foreclosure',
      player: player.name,
      price: propertyOption.price,
      propertyKey: propertyOption.key,
      previousPlayer: propertyOption.ownerName,
      balanceAfterNewOwner: balanceAfter,
      balanceAfterOldOwner: previousOwnerBalanceAfter,
    };
  } else {
    payload = {
      type: 'purchase-property',
      player: player.name,
      price: propertyOption.price,
      propertyKey: propertyOption.key,
      balanceAfter,
    };
  }

  const bankTransaction = await BankTransactionInterface.show('Grundstückskauf', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.recordCompletedTransaction();
  gameStore.updatePlayerBalance(player.id, balanceAfter);

  if (propertyOption.isForclosure && propertyOption.previousOwnerId) {
    const previousOwner = playerBalances.value.find(account => account.id === propertyOption.previousOwnerId);
    if (previousOwner) {
      gameStore.updatePlayerBalance(
        propertyOption.previousOwnerId,
        previousOwner.balance + propertyOption.price,
      );
    }
  }

  gameStore.purchaseProperty(propertyOption.key, player.id);

  close()
}

function getOwnerName(ownerId: string) {
  return playerBalances.value.find(player => player.id === ownerId)?.name || 'Unbekannt';
}
</script>
