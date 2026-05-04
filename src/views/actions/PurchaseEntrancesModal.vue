<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Eingänge kaufen</ion-title>
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
            Kein Spieler besitzt Grundstücke.
          </ion-note>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="selectedPlayer">
        <ion-card-content>
          <ion-list v-if="propertyOptions.length" lines="none">
            <ion-item v-for="propertyOption in propertyOptions" :key="propertyOption.key">
              <ion-label>
                <h2>{{ propertyOption.property.name }}</h2>
                <p>Preis: {{ propertyOption.price }}</p>
                <p>Eingänge: {{ propertyOption.entranceCount }}</p>
              </ion-label>
              <ion-button
                slot="end"
                :color="isInCart(propertyOption.key, propertyOption.price) ? 'danger' : 'success'"
                :aria-label="getCartButtonLabel(propertyOption, propertyOption.price)"
                :disabled="!canToggleCart(propertyOption, propertyOption.price)"
                @click="toggleCart(propertyOption, propertyOption.price)"
              >
                <ion-icon
                  slot="icon-only"
                  :icon="isInCart(propertyOption.key, propertyOption.price) ? removeCircleOutline : addCircleOutline"
                />
              </ion-button>
              <ion-button
                slot="end"
                :color="isInCart(propertyOption.key, 0) ? 'danger' : 'primary'"
                :aria-label="getCartButtonLabel(propertyOption, 0)"
                :disabled="!canToggleCart(propertyOption, 0)"
                @click="toggleCart(propertyOption, 0)"
              >
                <ion-icon
                  slot="icon-only"
                  :icon="isInCart(propertyOption.key, 0) ? removeCircleOutline : giftOutline"
                />
              </ion-button>
            </ion-item>
          </ion-list>
          <ion-note v-else color="medium">
            Keine Grundstücke verfügbar.
          </ion-note>

        </ion-card-content>
      </ion-card>

      <ion-card v-if="cartCount" >
        <ion-card-content>

            <ion-button expand="block" color="success"
              :disabled="!canPurchase"
              @click="purchase">{{ cartCount }} Eingänge kaufen
            </ion-button>
            <ion-note v-if="!canPurchase" color="danger">
              Unzureichende Mittel.
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
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { addCircleOutline, giftOutline, removeCircleOutline } from 'ionicons/icons';
import { properties, type PropertyKey } from '@/data/properties';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { useGameStore, type PlayerBalance } from '@/stores/game';
import type { Property } from '@/types';

type PropertyOption = {
  key: PropertyKey;
  property: Property;
  price: number;
  entranceCount: number;
};

type CartEntry = {
  propertyKey: PropertyKey;
  price: number;
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
const cartItems = ref<CartEntry[]>([]);

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

const cartEntries = computed(() => (
  cartItems.value.flatMap((cartItem) => {
    const propertyOption = propertyOptions.value.find(option => option.key === cartItem.propertyKey);
    return propertyOption ? [cartItem] : [];
  })
));

const cartCount = computed(() => cartEntries.value.length);
const sumPrice = computed(() => cartEntries.value.reduce((sum, entry) => sum + entry.price, 0));
const balanceAfter = computed(() => (selectedPlayer.value?.balance ?? 0) - sumPrice.value);
const canPurchase = computed(() => Boolean(selectedPlayer.value && balanceAfter.value >= 0));

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

watch(selectedPlayerId, () => {
  cartItems.value = [];
});

watch(propertyOptions, (options) => {
  cartItems.value = cartItems.value.filter(cartItem => (
    options.some(option => option.key === cartItem.propertyKey)
  ));
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

function close() {
  selectedPlayerId.value = playersWithProperties.value.length === 1 ? playersWithProperties.value[0].id : null;
  cartItems.value = [];
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
      price: property.entrancePrice,
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

function isInCart(propertyKey: PropertyKey, price?: number) {
  return cartItems.value.some(cartItem => (
    cartItem.propertyKey === propertyKey && (price === undefined || cartItem.price === price)
  ));
}

function toggleCart(propertyOption: PropertyOption, price: number) {
  if (isInCart(propertyOption.key, price)) {
    cartItems.value = cartItems.value.filter(cartItem => (
      cartItem.propertyKey !== propertyOption.key || cartItem.price !== price
    ));
    return;
  }

  if (!hasOpenEntranceSlot(propertyOption.property, propertyOption.entranceCount + getCartCount(propertyOption.key))) {
    return;
  }

  cartItems.value = [
    ...cartItems.value.filter(cartItem => price !== 0 || cartItem.price !== 0),
    { propertyKey: propertyOption.key, price },
  ];
}

function canToggleCart(propertyOption: PropertyOption, price: number) {
  return isInCart(propertyOption.key, price)
    || hasOpenEntranceSlot(propertyOption.property, propertyOption.entranceCount + getCartCount(propertyOption.key));
}

function getCartCount(propertyKey: PropertyKey) {
  return cartItems.value.filter(cartItem => cartItem.propertyKey === propertyKey).length;
}

function getCartButtonLabel(propertyOption: PropertyOption, price: number) {
  const priceLabel = price === 0 ? 'kostenlosen Eingang' : 'Eingang';

  return isInCart(propertyOption.key, price)
    ? `${propertyOption.property.name} aus dem Warenkorb entfernen`
    : `${priceLabel} für ${propertyOption.property.name} zum Warenkorb hinzufügen`;
}

async function purchase() {
  const player = selectedPlayer.value;
  if (!player || !cartEntries.value.length || !canPurchase.value) {
    return;
  }

  const payload = {
    type: 'purchase-entrances',
    player: player.name,
    entrances: cartEntries.value,
    sumPrice: sumPrice.value,
    balanceAfter: balanceAfter.value,
  };

  const bankTransaction = await BankTransactionInterface.show('Eingänge kaufen', payload);

  if (!bankTransaction.wasSuccessful) {
    return;
  }

  gameStore.recordCompletedTransaction();
  gameStore.updatePlayerBalance(player.id, balanceAfter.value);
  cartEntries.value.forEach(entry => {
    gameStore.addEntrance(entry.propertyKey, player.id);
  });

  close();
}
</script>

<style scoped>
.purchase-summary {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
