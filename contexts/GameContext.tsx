
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Game, GameStatus, DailySummary } from '../types';
import { SEED_GAMES } from '../constants';
import { supabase, isMissingTableError, formatError } from '../lib/supabase';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface GameContextType {
  games: Game[];
  addGame: (newGame: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateGame: (gameId: string, updates: Partial<Game>) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  saveDailySummary: (summary: DailySummary) => Promise<void>;
  resetDatabase: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isTableMissing: boolean;
  syncStatus: SyncStatus;
  syncAttempts: number;
  sheetUrl: string | null;
  spreadsheetViewUrl: string | null;
  saveSheetUrl: (webAppUrl: string, viewUrl: string) => void;
  clearSheetUrl: () => void;
  refetchGames: () => void;
  syncAllToGoogleSheets: () => Promise<{ success: boolean; count: number; error?: string }>;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'googleSheetWebAppUrl';
const VIEW_STORAGE_KEY = 'googleSpreadsheetViewUrl';
const GAMES_CACHE_KEY = 'snooker_games_cache';

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [games, setGames] = useState<Game[]>(() => {
    const cached = localStorage.getItem(GAMES_CACHE_KEY);
    return cached ? JSON.parse(cached) : SEED_GAMES;
  });
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [spreadsheetViewUrl, setSpreadsheetViewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTableMissing, setIsTableMissing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncAttempts, setSyncAttempts] = useState(0);

  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsTableMissing(false);
    try {
      const { data, error: sbError } = await supabase
        .from('games')
        .select('*')
        .order('startTime', { ascending: false });

      if (sbError) throw sbError;
      
      const gameData = data || [];
      setGames(gameData);
      localStorage.setItem(GAMES_CACHE_KEY, JSON.stringify(gameData));
      setSyncStatus('idle');
    } catch (err: any) {
      if (isMissingTableError(err)) {
        setIsTableMissing(true);
        setError("Setup Required: The 'games' table does not exist in your Supabase project.");
      } else {
        const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
        setError(isFetchError ? "Network Error: Could not reach database." : formatError(err));
        if (isFetchError) setSyncStatus('offline');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const channel = supabase
      .channel('public:games')
      .on('postgres_changes', { event: '*', table: 'games', schema: 'public' }, () => fetchGames())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchGames]);

  const saveSheetUrl = (webAppUrl: string, viewUrl: string) => {
    localStorage.setItem(STORAGE_KEY, webAppUrl);
    localStorage.setItem(VIEW_STORAGE_KEY, viewUrl);
    setSheetUrl(webAppUrl);
    setSpreadsheetViewUrl(viewUrl);
  };

  const clearSheetUrl = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VIEW_STORAGE_KEY);
    setSheetUrl(null);
    setSpreadsheetViewUrl(null);
  };

  const addGame = useCallback(async (newGameData: Omit<Game, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSyncStatus('syncing');
    try {
      if (!newGameData.createdBy || newGameData.createdBy.length < 10) {
          throw new Error(`Invalid User ID: ${newGameData.createdBy}. Please log out and log back in.`);
      }

      const { error: sbError } = await supabase.from('games').insert([newGameData]);
      if (sbError) throw sbError;
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      await fetchGames();
    } catch (err: any) {
      setSyncStatus('error');
      const errorDetail = formatError(err);
      if (err.code === '23503') {
          alert(`Sync Error: Your account ID is not recognized by the database. Please Logout and Login again.`);
      } else {
          alert(`Failed to start game: ${errorDetail}`);
      }
    }
  }, [fetchGames]);

  const updateGame = useCallback(async (gameId: string, updates: Partial<Game>) => {
    setSyncStatus('syncing');
    try {
      const { error: sbError } = await supabase.from('games').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', gameId);
      if (sbError) throw sbError;
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      await fetchGames();
    } catch (err: any) {
      setSyncStatus('error');
      const errorDetail = formatError(err);
      alert(`Update failed: ${errorDetail}`);
    }
  }, [fetchGames]);

  const deleteGame = useCallback(async (gameId: string) => {
    setSyncStatus('syncing');
    try {
      const { error: sbError } = await supabase.from('games').delete().eq('id', gameId);
      if (sbError) throw sbError;
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      await fetchGames();
    } catch (err: any) {
      setSyncStatus('error');
      const errorDetail = formatError(err);
      alert(`Delete failed: ${errorDetail}`);
    }
  }, [fetchGames]);

  const saveDailySummary = useCallback(async (summary: DailySummary) => {
    setSyncAttempts(prev => prev + 1);
    
    const payload = {
        date: summary.date,
        totalPaid: summary.totalPaid,
        totalLoan: summary.totalLoan,
        totalDiscount: summary.totalDiscount,
        gameCount: summary.gameCount
    };
    
    try {
      const { error: sbError } = await supabase
          .from('daily_summaries')
          .upsert([payload], { onConflict: 'date' });
      
      if (sbError) {
          if (sbError.code === 'PGRST204') {
              console.warn("Retrying minimal save due to schema cache mismatch...");
              const minimalPayload = { 
                  date: payload.date, 
                  totalPaid: payload.totalPaid 
              };
              const { error: minimalError } = await supabase
                  .from('daily_summaries')
                  .upsert([minimalPayload], { onConflict: 'date' });
              
              if (minimalError) throw minimalError;
          } else {
              throw sbError;
          }
      }

      // Automatically backup to Google Sheets if connected
      if (sheetUrl) {
        setSyncStatus('syncing');
        try {
          await fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain'
            },
            body: JSON.stringify(payload)
          });
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (sheetErr) {
          console.error("Failed to backup daily closure to Google Sheets:", sheetErr);
          setSyncStatus('error');
        }
      }
    } catch (e: any) {
      console.error('Save daily summary failed:', formatError(e));
      throw e;
    }
  }, [sheetUrl]);

  const syncAllToGoogleSheets = useCallback(async () => {
    if (!sheetUrl) {
      return { success: false, count: 0, error: 'Google Sheets Deployment URL is not set.' };
    }

    setSyncStatus('syncing');
    try {
      const { data: summaries, error: sbError } = await supabase
        .from('daily_summaries')
        .select('*')
        .order('date', { ascending: true });

      if (sbError) throw sbError;

      if (!summaries || summaries.length === 0) {
        setSyncStatus('idle');
        return { success: true, count: 0 };
      }

      let count = 0;
      for (const summary of summaries) {
        try {
          await fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
              date: summary.date,
              totalPaid: summary.totalPaid || 0,
              totalLoan: summary.totalLoan || 0,
              totalDiscount: summary.totalDiscount || 0,
              gameCount: summary.gameCount || 0
            })
          });
          count++;
        } catch (err) {
          console.error(`Error syncing record for ${summary.date}:`, err);
        }
      }

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return { success: true, count };
    } catch (err: any) {
      setSyncStatus('error');
      const msg = formatError(err);
      return { success: false, count: 0, error: msg };
    }
  }, [sheetUrl]);

  const resetDatabase = useCallback(async () => {
    setIsLoading(true);
    setSyncStatus('syncing');
    try {
      // 1. Delete all games
      const { error: gameDelErr } = await supabase.from('games').delete().not('id', 'is', null);
      if (gameDelErr) throw gameDelErr;

      // 2. Delete all daily summaries
      const { error: summaryDelErr } = await supabase.from('daily_summaries').delete().not('id', 'is', null);
      if (summaryDelErr) throw summaryDelErr;

      // 3. Reset business date to today
      const today = new Date().toISOString().split('T')[0];
      const { error: configErr } = await supabase.from('app_config').update({ value: today }).eq('key', 'business_date');
      if (configErr) throw configErr;

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      await fetchGames();
    } catch (err: any) {
      setSyncStatus('error');
      alert(`Reset failed: ${formatError(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchGames]);

  useEffect(() => {
    setSheetUrl(localStorage.getItem(STORAGE_KEY));
    setSpreadsheetViewUrl(localStorage.getItem(VIEW_STORAGE_KEY));
  }, []);

  return (
    <GameContext.Provider value={{ 
      games, addGame, updateGame, deleteGame, saveDailySummary, resetDatabase,
      isLoading, error, isTableMissing, syncStatus, syncAttempts, sheetUrl, spreadsheetViewUrl, 
      saveSheetUrl, clearSheetUrl, refetchGames: fetchGames, syncAllToGoogleSheets
    }}>
      {children}
    </GameContext.Provider>
  );
};
