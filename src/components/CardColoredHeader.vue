<template>
  <ion-card-header>
    <ion-card-subtitle>{{ title }}</ion-card-subtitle>
  </ion-card-header>
</template>
<script setup lang="ts">
import { IonCardHeader, IonCardSubtitle } from '@ionic/vue';
const props = defineProps<{
  title: string;
}>();
</script>
<style scoped>
ion-card-header {
  background-color: #eee;
  padding: .5rem 1rem;
}
ion-card-subtitle {
  color: #464646;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 1rem;
}
</style>