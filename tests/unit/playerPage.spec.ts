import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PlayerPage from '@/views/PlayerPage.vue';
import { useGameStore } from '@/stores/game';

vi.mock('@/composables/useWakeLock', () => ({
  useWakeLock: () => undefined,
}));

vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');

  return {
    ...actual,
    onIonViewWillLeave: vi.fn(),
  };
});

describe('PlayerPage.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('shows other players and bank player properties without balances', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const gameStore = useGameStore();
    gameStore.setActivePlayerSession({
      id: 'player-1',
      name: 'Carol',
      startingCapital: 18000,
      balance: 18000,
      properties: [],
      players: [
        {
          id: 'player-1',
          name: 'Carol',
          balance: 18000,
          properties: [],
        },
        {
          id: 'player-2',
          name: 'Bob',
          balance: 12000,
          properties: [
            {
              key: 'hotel-boomerang',
              name: 'BOOMERANG BAY',
              boughtImprovements: [true, false],
              entranceCount: 2,
            },
          ],
        },
        {
          id: 'bank-player',
          name: 'Bank Alice',
          balance: 15000,
          properties: [
            {
              key: 'hotel-sahara',
              name: 'SAHARA',
              boughtImprovements: [false, false, false, false],
              entranceCount: 0,
            },
          ],
        },
      ],
      version: 4,
    });

    const wrapper = mount(PlayerPage, {
      global: {
        plugins: [pinia],
        stubs: {
          IonBackButton: true,
          IonButton: true,
          IonButtons: true,
          IonCard: { template: '<article><slot /></article>' },
          IonCardContent: { template: '<section><slot /></section>' },
          IonContent: { template: '<main><slot /></main>' },
          IonHeader: { template: '<header><slot /></header>' },
          IonIcon: true,
          IonInput: true,
          IonItem: { template: '<div><slot /></div>' },
          IonLabel: { template: '<div><slot /></div>' },
          IonList: { template: '<div><slot /></div>' },
          IonPage: { template: '<div><slot /></div>' },
          IonSelect: true,
          IonSelectOption: true,
          IonText: { template: '<div><slot /></div>' },
          IonTitle: { template: '<h1><slot /></h1>' },
          IonToolbar: { template: '<div><slot /></div>' },
          PlayerGamingPanel: { template: '<section class="own-panel"><slot /></section>' },
          PropertyStars: { template: '<span />' },
        },
      },
    });

    const overviewText = wrapper.find('.player-overviews').text();
    expect(overviewText).toContain('Bob');
    expect(overviewText).toContain('Bank Alice');
    expect(overviewText).toContain('BOOMERANG BAY');
    expect(overviewText).toContain('Hauptgebäude');
    expect(overviewText).toContain('2 Eingange');
    expect(overviewText).toContain('SAHARA');
    expect(overviewText).toContain('Unbebaut');
    expect(overviewText).not.toContain('Carol');
    expect(overviewText).not.toContain('12000');
    expect(overviewText).not.toContain('15000');
  });
});
