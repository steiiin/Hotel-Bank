import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, test } from 'vitest';
import { useGameStore } from '@/stores/game';

describe('game store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActivePinia(createPinia());
  });

  test('adds players and exposes starting balances', async () => {
    const store = useGameStore();

    store.newPlayerName = 'Alice';
    store.addPlayer();
    await nextTick();

    expect(store.players).toEqual([{ id: 1, name: 'Alice' }]);
    expect(store.newPlayerName).toBe('');
    expect(store.playerBalances).toEqual([
      { id: 'player-1', name: 'Alice', balance: 15000 },
    ]);
  });

  test('tracks entrance counts per property ownership', () => {
    const store = useGameStore();

    expect(store.purchaseProperty('hotel-boomerang', 'player-1')).toBe(true);
    expect(store.propertyOwnerships[0].entranceCount).toBe(0);

    expect(store.addEntrance('hotel-boomerang', 'player-1')).toBe(true);
    expect(store.propertyOwnerships[0].entranceCount).toBe(1);
    expect(store.addEntrance('hotel-boomerang', 'player-2')).toBe(false);
    expect(store.propertyOwnerships[0].entranceCount).toBe(1);
  });

  test('returns to game tab when bank player is disabled', () => {
    const store = useGameStore();

    store.bankIsPlayer = true;
    store.activeTab = 'player';
    store.bankIsPlayer = false;

    expect(store.activeTab).toBe('game');
  });

  test('tracks whether a transaction has been completed', () => {
    const store = useGameStore();

    expect(store.hasCompletedTransaction).toBe(false);

    store.recordCompletedTransaction();

    expect(store.hasCompletedTransaction).toBe(true);

    store.resetGame();

    expect(store.hasCompletedTransaction).toBe(false);
  });

  test('restores persisted game state after a page refresh', async () => {
    const store = useGameStore();

    store.bankIsPlayer = true;
    store.bankPlayerName = 'Bank Alice';
    store.startingCapital = 12000;
    store.activeTab = 'bank';
    await addPlayers(store, ['Alice', 'Bob']);
    store.updatePlayerBalance('player-1', 9000);
    store.purchaseProperty('hotel-boomerang', 'player-1');
    store.buyImprovement('hotel-boomerang', 0);
    store.addEntrance('hotel-boomerang', 'player-1');
    store.recordCompletedTransaction();
    await nextTick();

    setActivePinia(createPinia());
    const restoredStore = useGameStore();

    expect(restoredStore.activeTab).toBe('bank');
    expect(restoredStore.bankIsPlayer).toBe(true);
    expect(restoredStore.bankPlayerName).toBe('Bank Alice');
    expect(restoredStore.startingCapital).toBe(12000);
    expect(restoredStore.players).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    expect(restoredStore.playerBalances.find(player => player.id === 'player-1')?.balance).toBe(9000);
    expect(restoredStore.propertyOwnerships).toEqual([
      {
        propertyKey: 'hotel-boomerang',
        ownerId: 'player-1',
        boughtImprovements: [true, false],
        entranceCount: 1,
      },
    ]);
    expect(restoredStore.hasCompletedTransaction).toBe(true);
  });

  test('starts a bankruptcy settlement for an unpaid debt', async () => {
    const store = useGameStore();

    store.newPlayerName = 'Alice';
    store.addPlayer();
    await nextTick();

    expect(store.startBankruptcySettlement({
      debtorId: 'player-1',
      creditor: { type: 'bank' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Testzahlung',
    })).toBe(true);

    expect(store.activeBankruptcySettlement).toMatchObject({
      debtorId: 'player-1',
      creditor: { type: 'bank' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Testzahlung',
    });
  });

  test('resolves a successful auction and pays the player creditor in full', async () => {
    const store = useGameStore();

    await addPlayers(store, ['Alice', 'Bob', 'Carol']);
    store.updatePlayerBalance('player-1', 2000);
    store.updatePlayerBalance('player-2', 5000);
    store.updatePlayerBalance('player-3', 10000);
    store.purchaseProperty('hotel-boomerang', 'player-1');
    store.startBankruptcySettlement({
      debtorId: 'player-1',
      creditor: { type: 'player', playerId: 'player-2' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Übernachtung',
    });

    expect(store.resolveBankruptcySettlement([
      { propertyKey: 'hotel-boomerang', buyerId: 'player-3', amount: 3000 },
    ])).toBe(true);

    expect(store.playerBalances).toEqual([
      { id: 'player-1', name: 'Alice', balance: 1000 },
      { id: 'player-2', name: 'Bob', balance: 9000 },
      { id: 'player-3', name: 'Carol', balance: 7000 },
    ]);
    expect(store.propertyOwnershipMap.get('hotel-boomerang')?.ownerId).toBe('player-3');
    expect(store.activeBankruptcySettlement).toBeNull();
  });

  test('resolves bankruptcy with partial creditor payment and removes unsold properties', async () => {
    const store = useGameStore();

    await addPlayers(store, ['Alice', 'Bob', 'Carol']);
    store.updatePlayerBalance('player-1', 2000);
    store.updatePlayerBalance('player-2', 5000);
    store.updatePlayerBalance('player-3', 10000);
    store.purchaseProperty('hotel-boomerang', 'player-1');
    store.purchaseProperty('hotel-sahara', 'player-1');
    store.startBankruptcySettlement({
      debtorId: 'player-1',
      creditor: { type: 'player', playerId: 'player-2' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Übernachtung',
    });

    expect(store.resolveBankruptcySettlement([
      { propertyKey: 'hotel-boomerang', buyerId: 'player-3', amount: 1000 },
    ])).toBe(true);
    await nextTick();

    expect(store.players).toEqual([
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Carol' },
    ]);
    expect(store.playerBalances).toEqual([
      { id: 'player-2', name: 'Bob', balance: 8000 },
      { id: 'player-3', name: 'Carol', balance: 9000 },
    ]);
    expect(store.propertyOwnershipMap.get('hotel-boomerang')?.ownerId).toBe('player-3');
    expect(store.propertyOwnershipMap.has('hotel-sahara')).toBe(false);
  });

  test('rejects auction bids the buyer cannot afford in total', async () => {
    const store = useGameStore();

    await addPlayers(store, ['Alice', 'Bob', 'Carol']);
    store.updatePlayerBalance('player-1', 2000);
    store.updatePlayerBalance('player-2', 5000);
    store.updatePlayerBalance('player-3', 1000);
    store.purchaseProperty('hotel-boomerang', 'player-1');
    store.purchaseProperty('hotel-sahara', 'player-1');
    store.startBankruptcySettlement({
      debtorId: 'player-1',
      creditor: { type: 'player', playerId: 'player-2' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Übernachtung',
    });

    expect(store.resolveBankruptcySettlement([
      { propertyKey: 'hotel-boomerang', buyerId: 'player-3', amount: 800 },
      { propertyKey: 'hotel-sahara', buyerId: 'player-3', amount: 800 },
    ])).toBe(false);

    expect(store.playerBalances.find(player => player.id === 'player-3')?.balance).toBe(1000);
    expect(store.propertyOwnershipMap.get('hotel-boomerang')?.ownerId).toBe('player-1');
    expect(store.activeBankruptcySettlement).not.toBeNull();
  });

  test('does not pay the configured bank player for bank creditor debts', async () => {
    const store = useGameStore();

    store.bankIsPlayer = true;
    await nextTick();
    await addPlayers(store, ['Alice', 'Carol']);
    store.updatePlayerBalance('bank-player', 15000);
    store.updatePlayerBalance('player-1', 2000);
    store.updatePlayerBalance('player-2', 10000);
    store.purchaseProperty('hotel-boomerang', 'player-1');
    store.startBankruptcySettlement({
      debtorId: 'player-1',
      creditor: { type: 'bank' },
      owedAmount: 4000,
      debtorStartingBalance: 2000,
      sourceActionLabel: 'Grundstückskauf',
    });

    expect(store.resolveBankruptcySettlement([
      { propertyKey: 'hotel-boomerang', buyerId: 'player-2', amount: 3000 },
    ])).toBe(true);

    expect(store.playerBalances.find(player => player.id === 'bank-player')?.balance).toBe(15000);
    expect(store.playerBalances.find(player => player.id === 'player-1')?.balance).toBe(1000);
  });
});

async function addPlayers(store: ReturnType<typeof useGameStore>, names: string[]) {
  for (const name of names) {
    store.newPlayerName = name;
    store.addPlayer();
  }

  await nextTick();
}
