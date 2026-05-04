<template>
  <ion-modal :is-open="isOpen" :backdrop-dismiss="false">
    <ion-header translucent>
      <ion-toolbar color="danger">
        <ion-title>Drohende Insolvenz</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card v-if="settlement && debtor">
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-label>
                <p>Insolvenz wegen</p>
                <h1>{{ settlement.sourceActionLabel }}</h1>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p>Schuldner</p>
                <h1>{{ debtor.name }}</h1>
              </ion-label>
            </ion-item>
            <ion-item v-if="creditorName!=='Bank'">
              <ion-label>
                <p>Gläubiger</p>
                <h1>{{ creditorName }}</h1>
              </ion-label>
            </ion-item>
            <div class="items-sidebyside">
              <ion-item>
                <ion-label>
                  <p>Forderung</p>
                  <h1>{{ new Intl.NumberFormat('de-DE').format(settlement.owedAmount) }}€</h1>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Kontostand</p>
                  <h1>{{ new Intl.NumberFormat('de-DE').format(settlement.debtorStartingBalance) }}€</h1>
                </ion-label>
              </ion-item>
              <ion-item>
                <ion-label>
                  <p>Fehlbetrag</p>
                  <h1>{{ new Intl.NumberFormat('de-DE').format(shortfall) }}€</h1>
                </ion-label>
              </ion-item>
            </div>

          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="settlement">
        <ion-card-content>

          <ion-card v-if="auctionRows.length"
            v-for="row in auctionRows" :key="row.propertyKey">
            <ion-card-content class="x-auction-row">
              <ion-toggle :checked="row.enabled" class="x--toggle" justify="space-between"
                @ionChange="setAuctionEnabled(row.propertyKey, Boolean($event.detail.checked))">
                <h1>{{ getPropertyName(row.propertyKey) }}</h1>
              </ion-toggle>
              <template v-if="isRowEnabled(row.propertyKey)">
                <hr>
                <ion-input
                  type="number" class="x--bid-input"
                  inputmode="numeric" label="Gebot" label-placement="fixed" fill="outline" min="0"
                  :value="row.amount"
                  @ionInput="setAuctionAmount(row.propertyKey, $event.detail.value)">
                </ion-input>
                <ion-select style="margin-top: 4px;"
                  interface="popover" label="Käufer" label-placement="fixed"
                  :value="row.buyerId" fill="outline"
                  @ionChange="setAuctionBuyer(row.propertyKey, $event.detail.value)">
                  <ion-select-option v-for="buyer in buyerOptions" :key="buyer.id" :value="buyer.id">
                    {{ buyer.name }} ({{ buyer.balance }}€)
                  </ion-select-option>
                </ion-select>

                <ion-note v-if="getRowError(row)" color="danger" class="row-error">
                  {{ getRowError(row) }}
                </ion-note>

              </template>
            </ion-card-content>
          </ion-card>
          <ion-card v-else>
            <ion-card-content style="text-align:center">
              Keine Grundstücke zum Versteigern.
            </ion-card-content>
          </ion-card>

        </ion-card-content>
      </ion-card>

      <ion-card v-if="settlement">
        <ion-card-content>
          <ion-list lines="none">
            <ion-item>
              <ion-label>
                <p>Versteigerungserlös</p>
                <h1>{{ new Intl.NumberFormat('de-DE').format(auctionEarnings) }}€</h1>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label :color="remainingBalance >= 0 ? 'success' : 'danger'">
                <p>Verbleibend</p>
                <h1>{{ new Intl.NumberFormat('de-DE').format(remainingBalance) }}€</h1>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="settlement">
        <ion-card-content>
          <ion-button
            v-if="remainingBalance >= 0"
            expand="block"
            color="success"
            :disabled="!canResolve"
            @click="resolve"
          >
            Versteigern
          </ion-button>
          <ion-button
            v-else
            expand="block"
            color="danger"
            :disabled="!canResolve"
            @click="resolve"
          >
            Bankrott
          </ion-button>
          <ion-note v-if="!canResolve && enabledRows.length" color="danger">
            Bitte alle aktivierten Versteigerungen vollständig und gültig ausfüllen.
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
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue';
import { properties, type PropertyKey } from '@/data/properties';
import { useGameStore, type BankruptcyAuction } from '@/stores/game';

type AuctionRow = {
  propertyKey: PropertyKey;
  enabled: boolean;
  amount: number | null;
  buyerId: string;
};

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'resolved'): void;
}>();

const gameStore = useGameStore();
const { activeBankruptcySettlement, playerBalances, propertyOwnerships } = storeToRefs(gameStore);
const auctionRows = ref<AuctionRow[]>([]);

const settlement = computed(() => activeBankruptcySettlement.value);
const debtor = computed(() => (
  settlement.value
    ? playerBalances.value.find(player => player.id === settlement.value?.debtorId) ?? null
    : null
));
const creditorName = computed(() => {
  const activeSettlement = settlement.value;
  const creditor = activeSettlement?.creditor;
  if (!creditor || creditor.type === 'bank') {
    return 'Bank';
  }

  return playerBalances.value.find(player => player.id === creditor.playerId)?.name ?? 'Unbekannt';
});
const debtorProperties = computed(() => {
  if (!settlement.value) {
    return [];
  }

  return propertyOwnerships.value.filter(ownership => ownership.ownerId === settlement.value?.debtorId);
});
const buyerOptions = computed(() => (
  settlement.value
    ? playerBalances.value.filter(player => player.id !== settlement.value?.debtorId)
    : []
));
const enabledRows = computed(() => auctionRows.value.filter(row => row.enabled));
const auctions = computed<BankruptcyAuction[]>(() => (
  enabledRows.value.flatMap((row): BankruptcyAuction[] => (
    row.buyerId && row.amount !== null
      ? [{ propertyKey: row.propertyKey, buyerId: row.buyerId, amount: row.amount }]
      : []
  ))
));
const auctionEarnings = computed(() => auctions.value.reduce((sum, auction) => sum + auction.amount, 0));
const remainingBalance = computed(() => (
  (settlement.value?.debtorStartingBalance ?? 0) + auctionEarnings.value - (settlement.value?.owedAmount ?? 0)
));
const shortfall = computed(() => Math.max(0, (settlement.value?.owedAmount ?? 0) - (settlement.value?.debtorStartingBalance ?? 0)));
const canResolve = computed(() => (
  enabledRows.value.length === auctions.value.length
  && gameStore.areBankruptcyAuctionsValid(auctions.value)
));

watch(debtorProperties, (ownerships) => {
  auctionRows.value = ownerships.map(ownership => {
    const existing = auctionRows.value.find(row => row.propertyKey === ownership.propertyKey);
    return existing ?? {
      propertyKey: ownership.propertyKey,
      enabled: false,
      amount: null,
      buyerId: '',
    };
  });
}, { immediate: true });

function setAuctionEnabled(propertyKey: PropertyKey, enabled: boolean) {
  const row = auctionRows.value.find(item => item.propertyKey === propertyKey);
  if (!row) {
    return;
  }

  row.enabled = enabled;
}

function setAuctionAmount(propertyKey: PropertyKey, value: string | number | null | undefined) {
  const row = auctionRows.value.find(item => item.propertyKey === propertyKey);
  if (!row) {
    return;
  }

  const amount = Number(value);
  row.amount = Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : null;
}

function setAuctionBuyer(propertyKey: PropertyKey, buyerId: string) {
  const row = auctionRows.value.find(item => item.propertyKey === propertyKey);
  if (!row) {
    return;
  }

  row.buyerId = buyerId;
}

function getPropertyName(propertyKey: PropertyKey) {
  return properties[propertyKey]?.name ?? propertyKey;
}

function getEnabledRow(propertyKey: PropertyKey) {
  return (enabledRows.value.find(e => e.propertyKey === propertyKey))
}

function isRowEnabled(propertyKey: PropertyKey) {
  return getEnabledRow(propertyKey)?.enabled ?? false
}

function getRowError(row: AuctionRow) {
  if (!row.enabled) {
    return '';
  }

  if (!row.amount || row.amount <= 0) {
    return 'Bitte einen Versteigerungserlös eintragen.';
  }

  if (!row.buyerId) {
    return 'Bitte einen Käufer wählen.';
  }

  const buyer = buyerOptions.value.find(player => player.id === row.buyerId);
  const buyerTotal = enabledRows.value
    .filter(item => item.buyerId === row.buyerId)
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);

  if (!buyer || buyer.balance < buyerTotal) {
    return 'Der Käufer hat nicht genug Guthaben.';
  }

  return '';
}

function resolve() {
  if (!canResolve.value) {
    return;
  }

  if (gameStore.resolveBankruptcySettlement(auctions.value)) {
    auctionRows.value = [];
    emit('resolved');
  }
}
</script>

<style scoped>
.row-error {
  display: block;
  margin: 4px 0 0 0;
  padding: 2px;
  text-align: center;
  background-color: #e4e4e4;
  border-radius: 4px;
}
.items-sidebyside {
  display: flex;
  justify-content: space-between;
}

.x-auction-row {
  color: #000;
}

.x-auction-row .x--toggle h1 {
  font-family: monospace;
}
.x-auction-row .x--bid-input :deep(.native-input) {
  appearance: textfield;
  text-align: right;
  font-size: 1.2rem;
  font-family: monospace;
}
</style>
