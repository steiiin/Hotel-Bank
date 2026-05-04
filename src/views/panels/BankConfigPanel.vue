<template>

  <ion-card>
    <ion-card-content>
      <ion-list lines="none">
        <ion-item lines="full">
          <ion-input
            v-model.number="startingCapital"
            type="number"
            min="0"
            label="Startkapital"
            label-placement="fixed"
            inputmode="numeric"
            :disabled="hasCompletedTransaction"
          />
        </ion-item>
        <ion-item :lines="bankIsPlayer ? 'inset' : 'none'">
          <ion-checkbox v-model="bankIsPlayer">
            Bank spielt gleichzeitig mit
          </ion-checkbox>
        </ion-item>
        <ion-item v-if="bankIsPlayer">
          <ion-input
            v-model="bankPlayerName"
            label="Spielername"
            label-placement="fixed"
            placeholder="Name der Bank"
            @input="sanitizeBankPlayerName"
            @ion-blur="formatBankPlayerName"
          />
        </ion-item>
      </ion-list>
    </ion-card-content>
  </ion-card>

  <ion-card>
    <ion-card-content>
      <ion-list lines="inset">

        <ion-item v-if="bankIsPlayer">
          <ion-label>{{ displayBankPlayerName }}</ion-label>
          <ion-note slot="end">Bank</ion-note>
        </ion-item>

        <ion-item v-for="player in players" :key="player.id">
          <ion-label>{{ player.name }}</ion-label>
          <ion-button
            slot="end"
            fill="clear"
            color="medium"
            aria-label="Spieler entfernen"
            @click="removePlayer(player.id)"
          >
            Entfernen
          </ion-button>
        </ion-item>

        <ion-item lines="none">
          <ion-input
            v-model="newPlayerName"
            placeholder="Spielername (nur A-Z)"
            @keyup.enter="requestAddPlayer"
            @input="sanitizeNewPlayerName"
          />
          <ion-button slot="end" @click="requestAddPlayer" :disabled="!isValidNewPlayer">Hinzufügen</ion-button>
        </ion-item>

      </ion-list>
    </ion-card-content>
  </ion-card>

  <ion-card>
    <ion-card-content>
      <p v-if="hasHostSession" class="session-info">
        Session aktiv<span v-if="hostSessionVersion"> · Version {{ hostSessionVersion }}</span>
        <span v-if="isPublishing"> · sendet...</span>
      </p>
      <p v-else class="session-info">Keine aktive Host-Session</p>
      <ion-button
        color="danger"
        expand="block"
        :disabled="isClosingSession"
        @click="showResetAlert = true"
      >
        Session schließen
      </ion-button>
    </ion-card-content>
  </ion-card>

  <IonAlert
    :is-open="showResetAlert"
    header="Session schließen"
    message="Möchtest du die Session wirklich schließen und zur Startseite wechseln?"
    :buttons="[
      { text: 'Abbrechen', role: 'cancel' },
      { text: 'Bestätigen', handler: handleResetConfirmed }
    ]"
    @didDismiss="showResetAlert = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
  IonAlert,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
} from '@ionic/vue';
import { useGameStore } from '@/stores/game';
import { BankTransactionInterface } from '@/composables/useBankTransactionInterface';
import { useHostGameSession } from '@/composables/useHostGameSession';

const router = useRouter();
const gameStore = useGameStore();
const {
  bankIsPlayer,
  bankPlayerName,
  startingCapital,
  newPlayerName,
  players,
  displayBankPlayerName,
  hasCompletedTransaction,
} = storeToRefs(gameStore);

const { addPlayer, removePlayer, resetGame, recordCompletedTransaction } = gameStore;
const {
  hasHostSession,
  hostSessionVersion,
  isCreatingSession,
  isPublishing,
  hostSessionError,
  canReplaceHostSession,
  startHostSession,
  closeHostSession,
  isClosingSession,
} = useHostGameSession();

const showResetAlert = ref(false);
const hostPassword = ref('');

const VALID_NAME_PATTERN = /^[a-zA-Z\s]*$/;

const isValidName = computed(() => {
  const name = newPlayerName.value.trim();
  return name.length > 0 && VALID_NAME_PATTERN.test(name);
});

const isDuplicateName = computed(() => {
  const name = newPlayerName.value.trim().toLowerCase();
  return players.value.some(p => p.name.toLowerCase() === name) ||
    (bankIsPlayer.value && bankPlayerName.value.trim().toLowerCase() === name);
});

const isValidNewPlayer = computed(() => isValidName.value && !isDuplicateName.value);

async function requestAddPlayer() {
  if (!newPlayerName.value.trim()) {
    return;
  }

  newPlayerName.value = newPlayerName.value.charAt(0).toUpperCase() + newPlayerName.value.slice(1);

  const bankTransaction = await BankTransactionInterface.show(
    newPlayerName.value || 'Spieler hinzufügen',
    {
      type: 'add-player',
      player: newPlayerName.value.trim(),
      startingCapital: startingCapital.value || 0,
    }
  );
  if (bankTransaction.wasSuccessful) {
    recordCompletedTransaction();
    addPlayer();
  }
}

async function requestStartHostSession() {
  const didStart = await startHostSession(hostPassword.value);
  if (didStart) {
    hostPassword.value = '';
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z\s]/g, '');
}

function sanitizeBankPlayerName() {
  bankPlayerName.value = sanitizeName(bankPlayerName.value);
}

function formatBankPlayerName() {
  bankPlayerName.value = bankPlayerName.value.charAt(0).toUpperCase() + bankPlayerName.value.slice(1);
}

const sanitizeNewPlayerName = () => {
  newPlayerName.value = sanitizeName(newPlayerName.value);
};

async function handleResetConfirmed() {
  const didClose = await closeHostSession();
  if (!didClose) {
    return false;
  }

  resetGame();
  await router.push({ name: 'Home' });
  return true;
}
</script>

<style scoped>
.session-info {
  color: var(--ion-color-medium);
  margin: 0 0 0.75rem;
  text-align: center;
}

.session-error {
  color: var(--ion-color-danger);
}
</style>
