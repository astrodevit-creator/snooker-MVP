
import { Game, GameStatus } from '../types';
import { DEFAULT_HOURLY_RATE } from '../constants';

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
 * Gets the minimum charge for a table based on its name and game count.
 * Royal tables: 40 MAD per game
 * Mini tables: 20 MAD per game
 */
export const getMinPrice = (tableName: string = '', notes: string | null = '1'): number => {
    const gamesCount = parseInt(notes || '1', 10) || 1;
    const name = tableName.toLowerCase();
    const ratePerGame = name.includes('royal') || name.includes('magnum') || name.includes('stroon') ? 40 : 20;
    return gamesCount * ratePerGame;
};

export const calculateLivePrice = (startTime: string, hourlyRate: number = DEFAULT_HOURLY_RATE, tableName: string = '', notes: string | null = '1') => {
    const gamesCount = parseInt(notes || '1', 10) || 1;
    const ratePerGame = hourlyRate || (tableName.toLowerCase().includes('royal') || tableName.toLowerCase().includes('magnum') || tableName.toLowerCase().includes('stroon') ? 40 : 20);
    return gamesCount * ratePerGame;
};

export const calculateFinalPrice = (startTime: string, endTime: string, discount: number = 0, hourlyRate: number = DEFAULT_HOURLY_RATE, tableName: string = '', notes: string | null = '1') => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationSeconds = Math.max(0, Math.floor((end - start) / 1000));
  
  const gamesCount = parseInt(notes || '1', 10) || 1;
  const ratePerGame = hourlyRate || (tableName.toLowerCase().includes('royal') || tableName.toLowerCase().includes('magnum') || tableName.toLowerCase().includes('stroon') ? 40 : 20);
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
  if (game.status === GameStatus.FINISHED && game.endTime) {
    const { durationSeconds, price, finalPrice } = calculateFinalPrice(
        game.startTime, 
        game.endTime, 
        game.discountMAD, 
        game.hourlyRate,
        game.tableName,
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
