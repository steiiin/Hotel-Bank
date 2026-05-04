<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Hotel-Bank</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Hotel-Bank</ion-title>
        </ion-toolbar>
      </ion-header>

      <div id="container">
        <ion-button expand="block" size="large" router-link="/player">
          Ich bin ein Spieler
        </ion-button>
        <ion-button expand="block" fill="outline" @click="openBankPasswordDialog">
          Ich bin die Bank
        </ion-button>
      </div>

      <IonAlert
        :is-open="showBankPasswordDialog"
        header="Spieler-Passwort"
        :message="bankPasswordDialogMessage"
        :inputs="[
          {
            name: 'password',
            type: 'password',
            placeholder: 'Passwort'
          }
        ]"
        :buttons="[
          { text: 'Abbrechen', role: 'cancel' },
          { text: 'Bank öffnen', handler: handleBankPasswordConfirmed }
        ]"
        @didPresent="focusBankPasswordInput"
        @didDismiss="showBankPasswordDialog = false"
      />

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonAlert, IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { useHostGameSession } from '@/composables/useHostGameSession';

const router = useRouter();
const showBankPasswordDialog = ref(false);
const bankPasswordError = ref('');
const { startHostSession, hasHostSession, canReplaceHostSession } = useHostGameSession();

const bankPasswordDialogMessage = computed(() => {
  if (bankPasswordError.value) {
    return bankPasswordError.value;
  }

  return 'Dieses Passwort verwenden Spieler später zum Beitreten.';
});

function openBankPasswordDialog() {
  bankPasswordError.value = '';
  showBankPasswordDialog.value = true;
}

function focusBankPasswordInput(event: CustomEvent) {
  const alert = event.target as HTMLElement;
  const passwordInput = alert.querySelector<HTMLInputElement>('input[type="password"]');
  setTimeout(() => passwordInput?.focus(), 300)
}

async function handleBankPasswordConfirmed(data: { password?: string }) {
  const password = data.password?.trim() || '';
  if (!password) {
    bankPasswordError.value = 'Bitte gib ein Spieler-Passwort ein.';
    return false;
  }

  if (!hasHostSession.value || canReplaceHostSession.value) {
    const didStart = await startHostSession(password);
    if (!didStart) {
      bankPasswordError.value = 'Es ist bereits eine aktive Session vorhanden. Neue Sessions sind erst nach dem Schließen oder nach 3 Stunden möglich.';
      return false;
    }
  }

  await router.push({ name: 'Bank' });
  return true;
}
</script>

<style scoped>
#container {

  text-align: center;
  position: absolute;
  left: 2rem;
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);

}

</style>
