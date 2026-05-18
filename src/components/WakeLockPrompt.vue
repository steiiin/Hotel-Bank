<template>
  <ion-card v-if="show" color="success" class="wake-lock-card">
    <ion-card-content>
      <div class="wake-lock-card-text">
        <h3>Bildschirmsperre aktivieren</h3>
        <p>Tippe hier, damit der Bildschirm beim Spielen eingeschaltet bleibt.</p>
      </div>
      <ion-button expand="block" @click="activate" :disabled="isActivating">
        {{ isActivating ? 'Aktivierung...' : 'Aktivieren' }}
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent } from '@ionic/vue';

defineProps({
  show: { type: Boolean, required: true },
  isActivating: { type: Boolean, required: true },
});

const emit = defineEmits(['activate']);

function activate() {
  emit('activate');
}
</script>

<style scoped>
.wake-lock-card {
  margin: 1rem;
}

.wake-lock-card-text {
  margin-bottom: 0.75rem;
}

.wake-lock-card-text h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.wake-lock-card-text p {
  margin: 0;
  color: var(--ion-color-dark-tint);
  font-size: 0.95rem;
}
</style>
