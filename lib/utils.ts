
import { Game, GameStatus, TableType } from '../types';
import { DEFAULT_RATE_PER_GAME } from '../constants';

export const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined) return '0.00 MAD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(amount).replace('MAD', '') + ' MAD';
};

export const formatDuration = (totalSeconds: number | null | undefined) => {
  if (totalSeconds === null || totalSeconds === undefined) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map(v => v < 10 ? '0' + v : v)
    .join(':');
};

/**
 * Legacy rows (created before the ratePerGame/hourlyRate split) stored the
 * per-game price in the `hourlyRate` column and had no `tableType` snapshot.
 * These helpers infer sane values for that older data.
 */
const inferTableType = (tableName: string = ''): TableType => {
  const name = tableName.toLowerCase();
  const isRoyal = name.includes('royal') || name.includes('magnum') || name.includes('stroon');
  return isRoyal ? TableType.ROYAL : TableType.MINI;
};

export const getEffectiveRatePerGame = (game: Pick<Game, 'ratePerGame' | 'hourlyRate' | 'tableName'>): number => {
  if (game.ratePerGame) return game.ratePerGame;
  if (game.hourlyRate) return game.hourlyRate; // legacy rows used this column for the per-game price
  return inferTableType(game.tableName) === TableType.ROYAL ? 40 : DEFAULT_RATE_PER_GAME;
};

export const getEffectiveTableType = (game: Pick<Game, 'tableType' | 'tableName'>): TableType => {
  return game.tableType || inferTableType(game.tableName);
};

/**
 * Gets the minimum charge for a table based on its rate-per-game and game count.
 */
export const getMinPrice = (ratePerGame: number = DEFAULT_RATE_PER_GAME, notes: string | null = '1'): number => {
  const gamesCount = parseInt(notes || '1', 10) || 1;
  return gamesCount * ratePerGame;
};

export const calculateLivePrice = (ratePerGame: number = DEFAULT_RATE_PER_GAME, notes: string | null = '1') => {
  const gamesCount = parseInt(notes || '1', 10) || 1;
  return gamesCount * ratePerGame;
};

export const calculateFinalPrice = (startTime: string, endTime: string, discount: number = 0, ratePerGame: number = DEFAULT_RATE_PER_GAME, notes: string | null = '1') => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationSeconds = Math.max(0, Math.floor((end - start) / 1000));

  const gamesCount = parseInt(notes || '1', 10) || 1;
  const price = gamesCount * ratePerGame;

  // The final price is (calculated - discount), with a minimum of 0
  const discountedPrice = price - discount;
  const finalPrice = Math.max(0, discountedPrice);

  return {
    durationSeconds,
    price,
    finalPrice
  };
};

export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const getGameComputedValues = (game: Game) => {
  const ratePerGame = getEffectiveRatePerGame(game);
  if (game.status === GameStatus.FINISHED && game.endTime) {
    const { durationSeconds, price, finalPrice } = calculateFinalPrice(
      game.startTime,
      game.endTime,
      game.discountMAD,
      ratePerGame,
      game.notes
    );
    return {
      durationSeconds,
      priceMAD: price,
      finalPriceMAD: finalPrice
    };
  }
  return {
    durationSeconds: game.durationSeconds,
    priceMAD: game.priceMAD,
    finalPriceMAD: game.finalPriceMAD,
  };
};

/**
 * The name of the player who lost (and therefore owes/pays for) a session.
 * Uses the explicitly stored `loserName` when available; falls back to
 * deriving it by elimination for older rows saved before that column existed.
 */
export const getLoserName = (game: Pick<Game, 'loserName' | 'player1' | 'player2' | 'winner'>): string | null => {
  if (game.loserName) return game.loserName;
  if (!game.player2) return game.player1;
  if (game.winner === game.player1) return game.player2;
  if (game.winner === game.player2) return game.player1;
  return game.player1;
};
