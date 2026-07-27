
import { createClient } from '@supabase/supabase-js';

// Load Supabase configuration. Prioritize local overrides from settings, then environment variables.
// IMPORTANT: There is intentionally no hardcoded fallback project/key here. Committing a working
// Supabase URL + anon key into source control would leak access to a real database to anyone who
// can read this repository. Configure VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local,
// or set them from the in-app Settings screen (stored in localStorage on this device only).
export const getSupabaseConfig = () => {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url') : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') : null;

  const envUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
  const envKey = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
    isCustom: !!(storedUrl || storedKey),
    isConfigured: !!(storedUrl || envUrl) && !!(storedKey || envKey),
  };
};

const config = getSupabaseConfig();

// Fall back to harmless placeholder values so createClient doesn't throw before the user has had a
// chance to configure their project from the Settings screen. Every request will simply fail until
// real credentials are provided — see `config.isConfigured` / the SetupWarning banner in App.tsx.
export const supabase = createClient(
  config.url || 'https://placeholder.supabase.co',
  config.anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    },
    global: {
      headers: { 'x-application-name': 'snooker-club-manager' }
    }
  }
);

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
