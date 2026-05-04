import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { properties, type PropertyKey } from '@/data/properties';

export type BankTab = 'game' | 'bank' | 'player';

export type Player = {
  id: number;
  name: string;
};

export type PlayerBalance = {
  id: string;
  name: string;
  balance: number;
};

export type PlayerSession = {
  id?: string;
  name: string;
  startingCapital: number;
  balance?: number;
  properties?: {
    key: string;
    name: string;
    boughtImprovements: boolean[];
    entranceCount: number;
  }[];
  version?: number;
};

export type PropertyOwnership = {
  propertyKey: PropertyKey;
  ownerId: string; // player id or 'bank'
  boughtImprovements: boolean[]; // array of booleans indicating which improvements are bought
  entranceCount: number;
};

export type BankruptcyCreditor =
  | { type: 'bank' }
  | { type: 'player'; playerId: string };

export type BankruptcySettlement = {
  debtorId: string;
  creditor: BankruptcyCreditor;
  owedAmount: number;
  debtorStartingBalance: number;
  sourceActionLabel: string;
};

export type BankruptcyAuction = {
  propertyKey: PropertyKey;
  buyerId: string;
  amount: number;
};

type PersistedGameState = {
  version: 1;
  activeTab: BankTab;
  bankIsPlayer: boolean;
  bankPlayerName: string;
  startingCapital: number;
  newPlayerName: string;
  players: Player[];
  nextPlayerId: number;
  playerBalances: PlayerBalance[];
  activePlayerSession: PlayerSession | null;
  propertyOwnerships: PropertyOwnership[];
  hasCompletedTransaction: boolean;
  activeBankruptcySettlement: BankruptcySettlement | null;
};

const GAME_STATE_STORAGE_KEY = 'hotel-bank-game-state';

function readPersistedGameState(): PersistedGameState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawState = window.localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as Partial<PersistedGameState>;
    if (parsedState.version !== 1) {
      return null;
    }

    return parsedState as PersistedGameState;
  } catch {
    return null;
  }
}

function writePersistedGameState(state: PersistedGameState) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; gameplay should continue even if storage is unavailable.
  }
}

export const useGameStore = defineStore('game', () => {
  const persistedState = readPersistedGameState();
  const activeTab = ref<BankTab>(persistedState?.activeTab ?? 'game');
  const bankIsPlayer = ref(persistedState?.bankIsPlayer ?? false);
  const bankPlayerName = ref(persistedState?.bankPlayerName ?? '');
  const startingCapital = ref(persistedState?.startingCapital ?? 15000);
  const newPlayerName = ref(persistedState?.newPlayerName ?? '');
  const players = ref<Player[]>(persistedState?.players ?? []);
  const nextPlayerId = ref(persistedState?.nextPlayerId ?? 1);
  const playerBalances = ref<PlayerBalance[]>(persistedState?.playerBalances ?? []);
  const activePlayerSession = ref<PlayerSession | null>(persistedState?.activePlayerSession ?? null);
  const propertyOwnerships = ref<PropertyOwnership[]>(persistedState?.propertyOwnerships ?? []);
  const hasCompletedTransaction = ref(persistedState?.hasCompletedTransaction ?? false);
  const activeBankruptcySettlement = ref<BankruptcySettlement | null>(persistedState?.activeBankruptcySettlement ?? null);

  const displayBankPlayerName = computed(() => bankPlayerName.value.trim() || 'Bankspieler');
  const playerCount = computed(() => players.value.length + (bankIsPlayer.value ? 1 : 0));
  const formattedStartingCapital = computed(() => startingCapital.value || 0);
  const playerAccounts = computed<PlayerBalance[]>(() => {
    const accounts = players.value.map((player) => ({
      id: `player-${player.id}`,
      name: player.name,
      balance: startingCapital.value || 0,
    }));

    if (bankIsPlayer.value) {
      accounts.unshift({
        id: 'bank-player',
        name: displayBankPlayerName.value,
        balance: startingCapital.value || 0,
      });
    }

    return accounts;
  });

  const propertyOwnershipMap = computed(() => {
    const map = new Map<PropertyKey, PropertyOwnership>();
    propertyOwnerships.value.forEach(ownership => {
      map.set(ownership.propertyKey, ownership);
    });
    return map;
  });

  watch(
    bankIsPlayer,
    (isPlayer) => {
      if (!isPlayer && activeTab.value === 'player') {
        activeTab.value = 'game';
      }
    },
    { flush: 'sync' },
  );

  watch(
    playerAccounts,
    (accounts) => {
      const currentBalances = new Map(playerBalances.value.map(account => [account.id, account.balance]));
      playerBalances.value = accounts.map(account => ({
        ...account,
        balance: currentBalances.get(account.id) ?? account.balance,
      }));
    },
    { immediate: true },
  );

  watch(
    () => ({
      version: 1 as const,
      activeTab: activeTab.value,
      bankIsPlayer: bankIsPlayer.value,
      bankPlayerName: bankPlayerName.value,
      startingCapital: startingCapital.value,
      newPlayerName: newPlayerName.value,
      players: players.value,
      nextPlayerId: nextPlayerId.value,
      playerBalances: playerBalances.value,
      activePlayerSession: activePlayerSession.value,
      propertyOwnerships: propertyOwnerships.value,
      hasCompletedTransaction: hasCompletedTransaction.value,
      activeBankruptcySettlement: activeBankruptcySettlement.value,
    }),
    writePersistedGameState,
    { deep: true, flush: 'post' },
  );

  function addPlayer() {
    const name = newPlayerName.value.trim();

    if (!name) {
      return;
    }

    // Validate: only a-z characters (case-insensitive)
    if (!/^[a-zA-Z\s]*$/.test(name)) {
      console.warn('Invalid player name: only a-z allowed');
      return;
    }

    // Check for duplicate names
    const nameLower = name.toLowerCase();
    if (players.value.some(p => p.name.toLowerCase() === nameLower)) {
      console.warn('Player with this name already exists');
      return;
    }
    if (bankIsPlayer.value && bankPlayerName.value.trim().toLowerCase() === nameLower) {
      console.warn('Bank player already has this name');
      return;
    }

    players.value.push({
      id: nextPlayerId.value,
      name,
    });
    nextPlayerId.value += 1;
    newPlayerName.value = '';
  }

  function removePlayer(playerId: number) {
    players.value = players.value.filter((player) => player.id !== playerId);
  }

  function removePlayerByAccountId(playerId: string) {
    if (playerId === 'bank-player') {
      bankIsPlayer.value = false;
      propertyOwnerships.value = propertyOwnerships.value.filter(ownership => ownership.ownerId !== playerId);

      if (activePlayerSession.value?.id === playerId) {
        activePlayerSession.value = null;
      }

      return true;
    }

    const numericId = parsePlayerAccountId(playerId);
    if (numericId === null) {
      return false;
    }

    const existed = players.value.some((player) => player.id === numericId);
    players.value = players.value.filter((player) => player.id !== numericId);
    propertyOwnerships.value = propertyOwnerships.value.filter(ownership => ownership.ownerId !== playerId);

    if (activePlayerSession.value?.id === playerId) {
      activePlayerSession.value = null;
    }

    return existed;
  }

  function setActivePlayerSession(player: PlayerSession) {
    activePlayerSession.value = {
      id: player.id,
      name: player.name,
      startingCapital: player.startingCapital || 0,
      balance: player.balance,
      properties: player.properties ?? [],
      version: player.version,
    };
  }

  function clearActivePlayerSession() {
    activePlayerSession.value = null;
  }

  function buyProperty(propertyKey: PropertyKey, ownerId: string) {
    const property = properties[propertyKey];
    if (!property) return false;

    // Check if property is already owned
    if (propertyOwnershipMap.value.has(propertyKey)) return false;

    // Initialize ownership with no improvements bought
    propertyOwnerships.value.push({
      propertyKey,
      ownerId,
      boughtImprovements: property.improvements.map(() => false),
      entranceCount: 0,
    });

    return true;
  }

  function purchaseProperty(propertyKey: PropertyKey, ownerId: string) {
    const property = properties[propertyKey];
    if (!property) return false;

    const ownership = propertyOwnershipMap.value.get(propertyKey);
    if (!ownership) {
      propertyOwnerships.value.push({
        propertyKey,
        ownerId,
        boughtImprovements: property.improvements.map(() => false),
        entranceCount: 0,
      });
      return true;
    }

    if (ownership.boughtImprovements.some(Boolean)) return false;

    ownership.ownerId = ownerId;
    ownership.entranceCount = ownership.entranceCount ?? 0;
    return true;
  }

  function updatePlayerBalance(playerId: string, balance: number) {
    const playerBalance = playerBalances.value.find(account => account.id === playerId);
    if (!playerBalance) return false;

    playerBalance.balance = balance;
    return true;
  }

  function startBankruptcySettlement(settlement: BankruptcySettlement) {
    const debtor = playerBalances.value.find(account => account.id === settlement.debtorId);
    if (!debtor || settlement.owedAmount <= 0) {
      return false;
    }

    activeBankruptcySettlement.value = {
      debtorId: settlement.debtorId,
      creditor: settlement.creditor,
      owedAmount: Math.max(0, Math.trunc(settlement.owedAmount)),
      debtorStartingBalance: Math.trunc(settlement.debtorStartingBalance),
      sourceActionLabel: settlement.sourceActionLabel,
    };
    return true;
  }

  function clearBankruptcySettlement() {
    activeBankruptcySettlement.value = null;
  }

  function resolveBankruptcySettlement(auctions: BankruptcyAuction[]) {
    const settlement = activeBankruptcySettlement.value;
    if (!settlement || !areBankruptcyAuctionsValid(auctions)) {
      return false;
    }

    const debtor = playerBalances.value.find(account => account.id === settlement.debtorId);
    if (!debtor) {
      clearBankruptcySettlement();
      return false;
    }

    const auctionEarnings = auctions.reduce((sum, auction) => sum + auction.amount, 0);
    const availablePayment = settlement.debtorStartingBalance + auctionEarnings;
    const isSaved = availablePayment >= settlement.owedAmount;
    const creditorPayment = isSaved ? settlement.owedAmount : Math.max(0, availablePayment);

    auctions.forEach((auction) => {
      const buyer = playerBalances.value.find(account => account.id === auction.buyerId);
      const ownership = propertyOwnerships.value.find(item => item.propertyKey === auction.propertyKey);

      if (!buyer || !ownership) {
        return;
      }

      buyer.balance -= auction.amount;
      ownership.ownerId = auction.buyerId;
    });

    if (settlement.creditor.type === 'player') {
      const creditorId = settlement.creditor.playerId;
      const creditor = playerBalances.value.find(account => account.id === creditorId);
      if (creditor) {
        creditor.balance += creditorPayment;
      }
    }

    if (isSaved) {
      debtor.balance = availablePayment - settlement.owedAmount;
    } else {
      removePlayerByAccountId(settlement.debtorId);
    }

    clearBankruptcySettlement();
    return true;
  }

  function areBankruptcyAuctionsValid(auctions: BankruptcyAuction[]) {
    const settlement = activeBankruptcySettlement.value;
    if (!settlement) {
      return false;
    }

    const seenProperties = new Set<PropertyKey>();
    const buyerTotals = new Map<string, number>();

    for (const auction of auctions) {
      if (auction.amount <= 0 || !Number.isFinite(auction.amount)) {
        return false;
      }

      if (auction.buyerId === settlement.debtorId) {
        return false;
      }

      if (seenProperties.has(auction.propertyKey)) {
        return false;
      }

      const ownership = propertyOwnerships.value.find(item => item.propertyKey === auction.propertyKey);
      if (!ownership || ownership.ownerId !== settlement.debtorId) {
        return false;
      }

      const buyer = playerBalances.value.find(account => account.id === auction.buyerId);
      if (!buyer) {
        return false;
      }

      seenProperties.add(auction.propertyKey);
      buyerTotals.set(auction.buyerId, (buyerTotals.get(auction.buyerId) ?? 0) + auction.amount);
    }

    for (const [buyerId, total] of buyerTotals) {
      const buyer = playerBalances.value.find(account => account.id === buyerId);
      if (!buyer || buyer.balance < total) {
        return false;
      }
    }

    return true;
  }

  function recordCompletedTransaction() {
    hasCompletedTransaction.value = true;
  }

  function resetGame() {
    activeTab.value = 'game';
    bankIsPlayer.value = false;
    bankPlayerName.value = '';
    startingCapital.value = 15000;
    newPlayerName.value = '';
    players.value = [];
    nextPlayerId.value = 1;
    playerBalances.value = [];
    activePlayerSession.value = null;
    propertyOwnerships.value = [];
    hasCompletedTransaction.value = false;
    activeBankruptcySettlement.value = null;
  }

  function sellProperty(propertyKey: PropertyKey) {
    const index = propertyOwnerships.value.findIndex(o => o.propertyKey === propertyKey);
    if (index === -1) return false;

    propertyOwnerships.value.splice(index, 1);
    return true;
  }

  function buyImprovement(propertyKey: PropertyKey, improvementIndex: number) {
    const ownership = propertyOwnershipMap.value.get(propertyKey);
    if (!ownership) return false;

    const property = properties[propertyKey];
    if (!property || improvementIndex >= property.improvements.length) return false;

    // Check if improvement is already bought
    if (ownership.boughtImprovements[improvementIndex]) return false;

    ownership.boughtImprovements[improvementIndex] = true;
    return true;
  }

  function sellImprovement(propertyKey: PropertyKey, improvementIndex: number) {
    const ownership = propertyOwnershipMap.value.get(propertyKey);
    if (!ownership) return false;

    const property = properties[propertyKey];
    if (!property || improvementIndex >= property.improvements.length) return false;

    // Check if improvement is not bought
    if (!ownership.boughtImprovements[improvementIndex]) return false;

    ownership.boughtImprovements[improvementIndex] = false;
    return true;
  }

  function addEntrance(propertyKey: PropertyKey, ownerId: string) {
    const ownership = propertyOwnershipMap.value.get(propertyKey);
    if (!ownership || ownership.ownerId !== ownerId) return false;

    const property = properties[propertyKey];
    if (!property) return false;

    const entranceCount = ownership.entranceCount ?? 0;
    if (property.maxEntrances > 0 && entranceCount >= property.maxEntrances) return false;

    ownership.entranceCount = entranceCount + 1;
    return true;
  }

  function getPropertyOwner(propertyKey: PropertyKey): string | null {
    const ownership = propertyOwnershipMap.value.get(propertyKey);
    return ownership ? ownership.ownerId : null;
  }

  function isImprovementBought(propertyKey: PropertyKey, improvementIndex: number): boolean {
    const ownership = propertyOwnershipMap.value.get(propertyKey);
    return ownership ? ownership.boughtImprovements[improvementIndex] || false : false;
  }

  function parsePlayerAccountId(playerId: string) {
    const match = /^player-(\d+)$/.exec(playerId);
    return match ? Number(match[1]) : null;
  }

  return {
    activeTab,
    bankIsPlayer,
    bankPlayerName,
    startingCapital,
    newPlayerName,
    players,
    displayBankPlayerName,
    playerCount,
    formattedStartingCapital,
    playerBalances,
    activePlayerSession,
    propertyOwnerships,
    hasCompletedTransaction,
    activeBankruptcySettlement,
    propertyOwnershipMap,
    addPlayer,
    removePlayer,
    removePlayerByAccountId,
    setActivePlayerSession,
    clearActivePlayerSession,
    buyProperty,
    purchaseProperty,
    sellProperty,
    buyImprovement,
    sellImprovement,
    addEntrance,
    updatePlayerBalance,
    startBankruptcySettlement,
    clearBankruptcySettlement,
    resolveBankruptcySettlement,
    areBankruptcyAuctionsValid,
    recordCompletedTransaction,
    resetGame,
    getPropertyOwner,
    isImprovementBought,
  };
});
