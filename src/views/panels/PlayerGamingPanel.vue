<template>
  <ion-card>
    <ion-card-content>
      <balance>
        <h2>Kontostand:</h2>
        <p>{{ formattedBalance }}€</p>
      </balance>

    </ion-card-content>
  </ion-card>
  <ion-card v-if="visibleProperties.length>0">
    <ion-card-content style="padding:0">
      <ion-list lines="none">
        <ion-item v-for="property in visibleProperties" :key="property.key">
          <ion-label>
            <h2>{{ property.name }}</h2>
            <template v-if="property.latestImprovement">
              <property-stars :stars="property.latestImprovement.stars"></property-stars>
              <p><b>{{ property.latestImprovement.name }}</b> - {{ formatEntranceCount(property.entranceCount) }}</p>
            </template>
            <p v-else><b>Unbebaut</b></p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-card-content>
  </ion-card>

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { IonCard, IonCardContent, IonItem, IonLabel, IonList } from '@ionic/vue';
import { properties as hotelProperties, type PropertyKey } from '@/data/properties';
import { useGameStore } from '@/stores/game';
import type { PropertyImprovement } from '@/types';
import PropertyStars from '@/components/PropertyStars.vue';

const props = defineProps<{
  playerName?: string;
  startingCapital?: number;
  balance?: number;
  properties?: {
    key: string;
    name: string;
    boughtImprovements: boolean[];
    entranceCount: number;
    latestImprovement?: PropertyImprovement | null;
  }[];
}>();

type VisibleProperty = {
  key: string;
  name: string;
  boughtImprovements: boolean[];
  entranceCount: number;
  latestImprovement: PropertyImprovement | null;
};

const gameStore = useGameStore();
const { displayBankPlayerName, formattedStartingCapital, playerBalances, propertyOwnerships } = storeToRefs(gameStore);

const visiblePlayerName = computed(() => props.playerName?.trim() || displayBankPlayerName.value);
const visibleStartingCapital = computed(() => props.startingCapital ?? formattedStartingCapital.value);
const bankPlayerBalance = computed(() => (
  playerBalances.value.find((player) => player.id === 'bank-player')?.balance ?? null
));
const bankPlayerProperties = computed(() => (
  propertyOwnerships.value
    .filter((ownership) => ownership.ownerId === 'bank-player')
    .map((ownership) => toVisibleProperty({
      key: ownership.propertyKey,
      name: hotelProperties[ownership.propertyKey]?.name ?? ownership.propertyKey,
      boughtImprovements: ownership.boughtImprovements,
      entranceCount: ownership.entranceCount ?? 0,
    }))
));
const visibleBalance = computed(() => props.balance ?? bankPlayerBalance.value);
const visibleProperties = computed<VisibleProperty[]>(() => (
  props.properties?.map(toVisibleProperty) ?? bankPlayerProperties.value
));

const formattedBalance = computed(() => {
  const balance = (visibleBalance.value !== null ? visibleBalance.value : visibleStartingCapital.value) ?? 0
  return new Intl.NumberFormat('de-DE').format(balance)
})

function toVisibleProperty(property: {
  key: string;
  name: string;
  boughtImprovements: boolean[];
  entranceCount: number;
  latestImprovement?: PropertyImprovement | null;
}): VisibleProperty {
  return {
    ...property,
    latestImprovement: property.latestImprovement ?? getLatestImprovement(property),
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


</script>

<style scoped>

  balance {
    color: #000;
  }

  balance h2 {
    margin: 0; padding: 0;
    font-size: .9rem;
    line-height: 1.1;
  }
  balance p {
    font-size: 2rem;
    font-family: monospace;
    margin: 0; padding: 0;
    line-height: 1.1;
  }

</style>
