
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { supabase, isMissingTableError } from '../lib/supabase';

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

interface BusinessDayContextType {
  businessDate: string;
  advanceDay: () => Promise<void>;
  isLoading: boolean;
  isTableMissing: boolean;
}

export const BusinessDayContext = createContext<BusinessDayContextType | undefined>(undefined);

const CONFIG_KEY = 'business_date';
const BUSINESS_DATE_CACHE_KEY = 'snooker_business_date_cache';

export const BusinessDayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [businessDate, setBusinessDate] = useState<string>(() => {
    return localStorage.getItem(BUSINESS_DATE_CACHE_KEY) || getTodayDateString();
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsTableMissing(false);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', CONFIG_KEY)
        .single();
      
      if (error) {
          if (isMissingTableError(error)) {
              setIsTableMissing(true);
              return;
          }
          if (error.code === 'PGRST116') {
              const today = getTodayDateString();
              await supabase.from('app_config').upsert([{ key: CONFIG_KEY, value: today }]);
              setBusinessDate(today);
              localStorage.setItem(BUSINESS_DATE_CACHE_KEY, today);
          } else {
              throw error;
          }
      } else if (data) {
        setBusinessDate(data.value);
        localStorage.setItem(BUSINESS_DATE_CACHE_KEY, data.value);
      }
    } catch (err: any) {
      console.warn('Config fetch failed, using local/cached date');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();

    const channel = supabase
      .channel('public:app_config')
      .on('postgres_changes', { event: 'UPDATE', table: 'app_config', schema: 'public' }, (payload) => {
        if (payload.new && payload.new.key === CONFIG_KEY) {
            setBusinessDate(payload.new.value);
            localStorage.setItem(BUSINESS_DATE_CACHE_KEY, payload.new.value);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConfig]);

  const advanceDay = useCallback(async () => {
    const [year, month, day] = businessDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    
    const nextDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const { error } = await supabase
        .from('app_config')
        .update({ value: nextDateStr })
        .eq('key', CONFIG_KEY);
    
    if (error) {
        console.error('Error advancing day:', error.message);
        throw error; // RETHROW
    }
    
    setBusinessDate(nextDateStr);
    localStorage.setItem(BUSINESS_DATE_CACHE_KEY, nextDateStr);
  }, [businessDate]);

  return (
    <BusinessDayContext.Provider value={{ businessDate, advanceDay, isLoading, isTableMissing }}>
      {children}
    </BusinessDayContext.Provider>
  );
};
