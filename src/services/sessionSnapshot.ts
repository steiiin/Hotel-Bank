import { properties } from '@/data/properties';
import type { PlayerBalance, PropertyOwnership } from '@/stores/game';

const BANK_PLAYER_ID = 'bank-player';

export type PublishedPlayerProperty = {
  key: string;
  name: string;
  boughtImprovements: boolean[];
  entranceCount: number;
};

export type PublishedPlayer = {
  id: string;
  name: string;
  balance: number;
  properties: PublishedPlayerProperty[];
};

export type PublishedPlayerSummary = {
  id: string;
  name: string;
};

export type PlayerUpdate = {
  sessionId: string;
  version: number;
  player: PublishedPlayer;
  players: PublishedPlayer[];
  playerToken?: string;
};

export function createPublishedPlayers(
  playerBalances: PlayerBalance[],
  propertyOwnerships: PropertyOwnership[],
  options: { includeBankPlayer?: boolean } = {},
): PublishedPlayer[] {
  return playerBalances.filter((player) => options.includeBankPlayer || player.id !== BANK_PLAYER_ID).map((player) => ({
    id: player.id,
    name: player.name,
    balance: player.balance,
    properties: propertyOwnerships
      .filter((ownership) => ownership.ownerId === player.id)
      .map((ownership) => ({
        key: ownership.propertyKey,
        name: properties[ownership.propertyKey]?.name ?? ownership.propertyKey,
        boughtImprovements: [...ownership.boughtImprovements],
        entranceCount: ownership.entranceCount ?? 0,
      })),
  }));
}
