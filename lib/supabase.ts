
import { createClient } from '@supabase/supabase-js';

// Load Supabase configuration. Prioritize local overrides from settings, then environment variables, then fallback to defaults.
export const getSupabaseConfig = () => {
  let storedUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url') : null;
  let storedKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') : null;

  // Stale credentials from the old project (known to be problematic) should be ignored and cleaned up
  if (storedUrl && (storedUrl.includes('eyhlvfbmflbmhiactefk') || storedKey?.includes('eyhlvfbmflbmhiactefk'))) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_anon_key');
    }
    storedUrl = null;
    storedKey = null;
  }

  return {
    url: storedUrl || (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://thyercrcplvcccowgwfz.supabase.co',
    anonKey: storedKey || (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_kKxbzrrbhoFPdjdINk1SiQ_sy8nwzSg',
    isCustom: !!(storedUrl || storedKey)
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  global: {
    headers: { 'x-application-name': 'snooker-club-manager' }
  }
});

/**
 * Robustly converts any error object (especially Supabase/Postgrest errors) 
 * into a human-readable string for debugging and display.
 */
export const formatError = (err: any): string => {
  if (!err) return "Unknown error";
  if (typeof err === 'string') return err;
  
  // Handle Supabase/Postgrest Error objects
  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.details) parts.push(`Details: ${err.details}`);
  if (err.hint) parts.push(`Hint: ${err.hint}`);
  if (err.code) parts.push(`Code: ${err.code}`);

  if (parts.length > 0) return parts.join(' | ');

  // Fallback to JSON stringification
  try {
    const json = JSON.stringify(err);
    if (json === '{}') {
        // Handle standard Error objects where properties aren't enumerable
        return err.toString() || "An unspecified error occurred.";
    }
    return json;
  } catch (e) {
    return String(err);
  }
};

/**
 * Helper to identify if an error is specifically about a missing table/schema.
 */
export const isMissingTableError = (error: any): boolean => {
  if (!error) return false;
  
  // Handle different variations of "table not found" errors
  const code = error.code;
  const message = error.message?.toLowerCase() || '';

  return (
    code === '42P01' || // undefined_table (Standard PG error)
    code === 'PGRST204' || // resource_not_found (PostgREST)
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('relation "public.games" does not exist') ||
    message.includes('relation "games" does not exist') ||
    message.includes('relation "users" does not exist') ||
    message.includes('relation "app_config" does not exist')
  );
};

/**
 * Diagnostic tool to check Supabase connectivity.
 */
export const checkSupabaseConnection = async (): Promise<{ ok: boolean; message: string; isSetupRequired?: boolean }> => {
  try {
    const { data, error, status } = await supabase.from('app_config').select('key').limit(1);
    
    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, message: "Database tables not found. Setup required.", isSetupRequired: true };
      }
      if (status === 401 || status === 403) {
        return { ok: false, message: "Access Denied: Check API Key or RLS settings." };
      }
      return { ok: false, message: formatError(error) };
    }
    return { ok: true, message: "Connected successfully." };
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      return { 
        ok: false, 
        message: "Network Error: Cannot reach Supabase API." 
      };
    }
    return { ok: false, message: formatError(err) };
  }
};
