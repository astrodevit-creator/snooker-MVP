
import { Game, GameStatus, PaymentStatus } from './types';

export const TABLES = [
  { id: 'royal-magnum', name: 'Royal Magnum', rate: 40 },
  { id: 'royal-stroon', name: 'Royal Stroon', rate: 40 },
  { id: 'mini-1', name: 'Mini 1', rate: 20 },
  { id: 'mini-2', name: 'Mini 2', rate: 20 },
];

export const DEFAULT_HOURLY_RATE = 20; // in MAD, fallback
export const TIMEZONE = 'Africa/Casablanca';

export const SEED_GAMES: Game[] = [];
