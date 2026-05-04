<template>
  <ion-modal :is-open="isOpen" @didDismiss="handleDismiss">
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="cancel">Abbrechen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">

      <template v-if="payloadType==='add-player'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              mit <price>{{ payload.startingCapital }}</price> Startkapital erstellen.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='passed-bank'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              zieht 2000€ ein.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='purchase-property'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              erwirbt das Grundstück
            </p>
            <property>{{ propertyInfo?.name }}</property> für <price>{{ payload.price }}</price>.
            <hr>
            <p>
              Kontostand danach: <price>{{ payload.balanceAfter }}</price>.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='purchase-property-foreclosure'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              lässt das Grundstück <br>
              <property>{{ propertyInfo?.name }}</property> von
            </p>
            <player>{{ payload.previousPlayer }}</player>
            <p>
              für <price>{{ payload.price }}</price> zwangsversteigern.
            </p>
            <hr>
            <p>
              Kontostand von <b>{{ payload.player }}</b> danach: <price>{{ payload.balanceAfterNewOwner }}</price>.
            </p>
            <p>
              Kontostand von <b>{{ payload.previousPlayer }}</b> danach: <price>{{ payload.balanceAfterOldOwner }}</price>.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='purchase-improvement'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              erweitert das Grundstück
            </p>
            <property>{{ propertyInfo?.name }}</property>
            <p>
              um das <improvement>{{ propertyInfo?.improvements[payload.improvementIndex]?.name }}</improvement> <br>
              für <price>{{ payload.price }}</price>.
            </p>
            <hr>
            <p>
              Kontostand danach: <price>{{ payload.balanceAfter }}</price>.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='purchase-entrances'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              erwirbt folgende Eingänge:
            </p>

            <ul style="padding-left:1rem;">
              <li v-for="(entrance, index) in entrancesInfo" :key="index">
                <property>{{ entrance.propertyInfo?.name }}</property>
                <span v-if="entrance.price > 0"> für <price>{{ entrance.price }}</price></span>
                <span v-else> kostenfrei</span>
              </li>
            </ul>
            <p v-if="entrancesInfo.length>1">
              Gesamtpreis: <price>{{ payload.sumPrice }}</price>.<br>
              Kontostand danach: <price>{{ payload.balanceAfter }}</price>.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='free-entrance'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.player }}</player>
            <p>
              erwirbt für <property>{{ entrancesInfo[0].propertyInfo?.name }}</property> einen<br>
              kostenlosen Eingang.
            </p>
          </ion-card-content>
        </ion-card>
      </template>
      <template v-else-if="payloadType==='rent'">
        <ion-card>
          <ion-card-content>
            <player>{{ payload.guest }}</player>
            <p>
              übernachtet für <b>{{ payload.nights === 1 ? 'eine Nacht' : `${payload.nights} Nächte` }}</b> <br>
              im <property>{{ propertyInfo?.name }}</property>,<br>
              und zahlt
            </p>
            <player>{{ payload.host }}</player>
            <p>
              dafür <price>{{ payload.price }}</price>.
            </p>
            <hr>
            <p>
              Kontostand von <b>{{ payload.guest }}</b> danach: <price>{{ payload.balanceAfterGuest }}</price>.<br>
              Kontostand von <b>{{ payload.host }}</b> danach: <price>{{ payload.balanceAfterHost }}</price>.
            </p>
          </ion-card-content>
        </ion-card>
      </template>

      <template v-else>
        <div class="transaction-modal-content">
          <p>Bitte prüfe die Transaktion und bestätige sie.</p>
          <pre class="transaction-payload">{{ payloadValue }}</pre>
        </div>
      </template>

    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button color="success" @click="confirm">Bestätigen</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from '@ionic/vue';
import { properties, type PropertyKey } from '@/data/properties';

interface Props {
  title: string;
  payload: Record<string, any>;
  isOpen: boolean;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'dismiss', role: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const payloadValue = computed(() => JSON.stringify(props.payload, null, 2));

const payloadType = computed(() => props.payload.type ?? 'unknown')

const propertyInfo = computed(() => {
  const key = props.payload.propertyKey as PropertyKey | undefined;
  return key ? properties[key] : undefined;
});

const entrancesInfo = computed(() => {
  const entrances = props.payload.entrances as Array<{propertyKey: PropertyKey; price: number}> | undefined;
  if (!entrances) return [];
  return entrances.map(entrance => ({
    ...entrance,
    propertyInfo: properties[entrance.propertyKey]
  }));
});

function confirm() {
  emit('confirm');
}

function cancel() {
  emit('cancel');
}

function handleDismiss(event: CustomEvent) {
  emit('dismiss', event?.detail?.role || 'cancel');
}
</script>

<style scoped>
.transaction-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transaction-payload {
  width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.03);
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

player {
  color: #000;
  font-size: 2rem;
  text-transform: uppercase;
  font-weight: bold;
}

property {
  color: #00f;
  font-weight: bold;
  letter-spacing: 1px;
}

improvement {
  color: #A00;
  font-weight: bold;
}

price {
  color: #000;
  font-family: monospace;
}
price::after {
  content: '€'
}


</style>
