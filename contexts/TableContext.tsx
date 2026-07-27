
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { TableConfig } from '../types';
import { SEED_TABLES } from '../constants';
import { supabase, isMissingTableError, formatError } from '../lib/supabase';

interface TableContextType {
  tables: TableConfig[];
  addTable: (table: Omit<TableConfig, 'id'>) => Promise<void>;
  updateTable: (tableId: string, updates: Partial<TableConfig>) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  isLoading: boolean;
  isTableMissing: boolean;
}

export const TableContext = createContext<TableContextType | undefined>(undefined);

const TABLES_CACHE_KEY = 'snooker_tables_cache';

export const TableProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<TableConfig[]>(() => {
    const cached = localStorage.getItem(TABLES_CACHE_KEY);
    return cached ? JSON.parse(cached) : SEED_TABLES;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);

  const fetchTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('sortOrder', { ascending: true });

      if (error) throw error;

      const tableData = data || [];
      if (tableData.length > 0) {
        setTables(tableData);
        localStorage.setItem(TABLES_CACHE_KEY, JSON.stringify(tableData));
      }
      setIsTableMissing(false);
    } catch (err: any) {
      if (isMissingTableError(err)) {
        setIsTableMissing(true);
      }
      const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      console.warn('Table config fetch failed:', isFetchError ? 'Offline Mode' : formatError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    const channel = supabase
      .channel('public:tables')
      .on('postgres_changes', { event: '*', table: 'tables', schema: 'public' }, () => fetchTables())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTables]);

  const addTable = useCallback(async (newTable: Omit<TableConfig, 'id'>) => {
    try {
      const { error } = await supabase.from('tables').insert([newTable]);
      if (error) throw error;
      await fetchTables();
    } catch (err: any) {
      alert(`Erreur lors de l'ajout de la table : ${formatError(err)}`);
    }
  }, [fetchTables]);

  const updateTable = useCallback(async (tableId: string, updates: Partial<TableConfig>) => {
    try {
      const { error } = await supabase.from('tables').update(updates).eq('id', tableId);
      if (error) throw error;
      await fetchTables();
    } catch (err: any) {
      alert(`Erreur lors de la mise à jour de la table : ${formatError(err)}`);
    }
  }, [fetchTables]);

  const deleteTable = useCallback(async (tableId: string) => {
    try {
      const { error } = await supabase.from('tables').delete().eq('id', tableId);
      if (error) throw error;
      await fetchTables();
    } catch (err: any) {
      alert(`Erreur lors de la suppression de la table : ${formatError(err)}`);
    }
  }, [fetchTables]);

  return (
    <TableContext.Provider value={{ tables, addTable, updateTable, deleteTable, isLoading, isTableMissing }}>
      {children}
    </TableContext.Provider>
  );
};
