
import { Game, TableConfig, TableType } from './types';

// Seed values used only as an offline/fallback display before the `tables`
// table has loaded from Supabase. The source of truth for prices lives in
// the database and is editable from Admin > Gestion des Tables.
export const SEED_TABLES: TableConfig[] = [
  { id: 'royal-magnum', name: 'Royal Magnum', type: TableType.ROYAL, hourlyRate: 90, ratePerGame: 40, active: true, sortOrder: 0 },
  { id: 'royal-stroon', name: 'Royal Stroon', type: TableType.ROYAL, hourlyRate: 90, ratePerGame: 40, active: true, sortOrder: 1 },
  { id: 'mini-1', name: 'Mini 1', type: TableType.MINI, hourlyRate: 60, ratePerGame: 20, active: true, sortOrder: 2 },
  { id: 'mini-2', name: 'Mini 2', type: TableType.MINI, hourlyRate: 60, ratePerGame: 20, active: true, sortOrder: 3 },
];

export const DEFAULT_RATE_PER_GAME = 20; // in MAD, fallback for legacy records
export const TIMEZONE = 'Africa/Casablanca';

export const SEED_GAMES: Game[] = [];
