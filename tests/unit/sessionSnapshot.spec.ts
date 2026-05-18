import { describe, expect, test } from 'vitest';
import { createPublishedPlayers } from '@/services/sessionSnapshot';

describe('session snapshot', () => {
  test('does not publish the bank player as a joinable player', () => {
    const snapshot = createPublishedPlayers(
      [
        { id: 'bank-player', name: 'Bank Alice', balance: 15000 },
        { id: 'player-1', name: 'Alice', balance: 17000 },
      ],
      [
        {
          propertyKey: 'hotel-boomerang',
          ownerId: 'bank-player',
          boughtImprovements: [true, false],
          entranceCount: 2,
        },
        {
          propertyKey: 'hotel-sahara',
          ownerId: 'player-1',
          boughtImprovements: [false, true, false, false],
          entranceCount: 1,
        },
      ],
    );

    expect(snapshot).toEqual([
      {
        id: 'player-1',
        name: 'Alice',
        balance: 17000,
        properties: [
          {
            key: 'hotel-sahara',
            name: 'SAHARA',
            boughtImprovements: [false, true, false, false],
            entranceCount: 1,
          },
        ],
      },
    ]);
  });

  test('can include the bank player for shared property overviews', () => {
    const snapshot = createPublishedPlayers(
      [
        { id: 'bank-player', name: 'Bank Alice', balance: 15000 },
        { id: 'player-1', name: 'Alice', balance: 17000 },
      ],
      [
        {
          propertyKey: 'hotel-boomerang',
          ownerId: 'bank-player',
          boughtImprovements: [true, false],
          entranceCount: 2,
        },
      ],
      { includeBankPlayer: true },
    );

    expect(snapshot).toEqual([
      {
        id: 'bank-player',
        name: 'Bank Alice',
        balance: 15000,
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
        id: 'player-1',
        name: 'Alice',
        balance: 17000,
        properties: [],
      },
    ]);
  });

  test('publishes only properties owned by each player', () => {
    const snapshot = createPublishedPlayers(
      [
        { id: 'player-1', name: 'Alice', balance: 17000 },
        { id: 'player-2', name: 'Bob', balance: 12000 },
      ],
      [
        {
          propertyKey: 'hotel-boomerang',
          ownerId: 'player-1',
          boughtImprovements: [true, false],
          entranceCount: 2,
        },
        {
          propertyKey: 'hotel-sahara',
          ownerId: 'player-2',
          boughtImprovements: [false, true, false, false],
          entranceCount: 1,
        },
      ],
    );

    expect(snapshot).toEqual([
      {
        id: 'player-1',
        name: 'Alice',
        balance: 17000,
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
        id: 'player-2',
        name: 'Bob',
        balance: 12000,
        properties: [
          {
            key: 'hotel-sahara',
            name: 'SAHARA',
            boughtImprovements: [false, true, false, false],
            entranceCount: 1,
          },
        ],
      },
    ]);
  });
});
