<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { star, starOutline } from 'ionicons/icons';
const props = defineProps<{
  stars: number;
}>();

</script>

<template>
  <div class="x-property-stars">
    <IonIcon :icon="star" v-if="stars>=1"></IonIcon>
    <IonIcon :icon="starOutline" v-else></IonIcon>
    <IonIcon :icon="star" v-if="stars>=2"></IonIcon>
    <IonIcon :icon="starOutline" v-else></IonIcon>
    <IonIcon :icon="star" v-if="stars>=3"></IonIcon>
    <IonIcon :icon="starOutline" v-else></IonIcon>
    <IonIcon :icon="star" v-if="stars>=4"></IonIcon>
    <IonIcon :icon="starOutline" v-else></IonIcon>
    <IonIcon :icon="star" v-if="stars>=5"></IonIcon>
    <IonIcon :icon="starOutline" v-else></IonIcon>
  </div>
</template>