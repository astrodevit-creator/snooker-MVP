
import React, { useState, useEffect } from 'react';
import { useGames } from '../hooks/useGames';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { CloseIcon, DatabaseIcon, CheckCircle, AlertTriangle, LoaderCircle } from './icons';
import CodeBlock from './ui/CodeBlock';
import { Card, CardContent } from './ui/Card';
import { getSupabaseConfig } from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const supabaseSql = `
-- SNOOKER CLUB MANAGER - SCHEMA REPAIR & INITIALIZATION (v2)
-- Run this in your Supabase SQL Editor. It is safe to re-run (idempotent).
-- v2 adds: per-table hourly/per-game pricing, daily session numbering,
-- an explicit loser field, and hashed passwords (replacing plaintext).

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ENSURE BASE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.users (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text UNIQUE NOT NULL,
  "password_hash" text,
  "role" text NOT NULL CHECK ("role" IN ('admin', 'user')),
  "allowedTables" text,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tables (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('mini', 'royal')),
  "hourlyRate" numeric NOT NULL DEFAULT 0,
  "ratePerGame" numeric NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "sortOrder" int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.day_counters (
  "date" date PRIMARY KEY,
  "counter" int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.games (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  "dayNumber" int,
  "tableName" text NOT NULL,
  "tableType" text,
  "hourlyRate" numeric NOT NULL,
  "ratePerGame" numeric,
  "startTime" timestamptz NOT NULL,
  "endTime" timestamptz,
  "player1" text NOT NULL,
  "player2" text,
  "winner" text,
  "loserName" text,
  "status" text NOT NULL,
  "durationSeconds" int,
  "priceMAD" numeric,
  "discountMAD" numeric DEFAULT 0,
  "finalPriceMAD" numeric,
  "paymentStatus" text NOT NULL,
  "notes" text,
  "createdBy" uuid REFERENCES public.users("id") NOT NULL,
  "modifiedBy" uuid REFERENCES public.users("id"),
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_summaries (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_config (
  "key" text PRIMARY KEY,
  "value" text NOT NULL
);

-- 2. ROBUST COLUMN REPAIR (FIXES PGRST204 ERRORS)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "allowedTables" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS "dayNumber" int;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS "tableType" text;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS "ratePerGame" numeric;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS "loserName" text;
ALTER TABLE public.daily_summaries ADD COLUMN IF NOT EXISTS "totalPaid" numeric DEFAULT 0;
ALTER TABLE public.daily_summaries ADD COLUMN IF NOT EXISTS "totalLoan" numeric DEFAULT 0;
ALTER TABLE public.daily_summaries ADD COLUMN IF NOT EXISTS "totalDiscount" numeric DEFAULT 0;
ALTER TABLE public.daily_summaries ADD COLUMN IF NOT EXISTS "gameCount" int DEFAULT 0;
ALTER TABLE public.daily_summaries ADD COLUMN IF NOT EXISTS "archivedAt" timestamptz DEFAULT now();

-- 3. ENSURE GAMES TABLE USES EXACT CASING
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='tablename') THEN
    ALTER TABLE public.games RENAME COLUMN "tablename" TO "tableName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='hourlyrate') THEN
    ALTER TABLE public.games RENAME COLUMN "hourlyrate" TO "hourlyRate";
  END IF;
END $$;

-- 4. DATA-SAFE MIGRATION: historically "hourlyRate" actually held the per-game
-- price that was charged. Backfill ratePerGame from it so past totals stay correct;
-- going forward hourlyRate becomes a purely informational per-hour snapshot.
UPDATE public.games SET "ratePerGame" = "hourlyRate" WHERE "ratePerGame" IS NULL;

-- 5. MIGRATE PASSWORDS TO BCRYPT HASHES (only runs if a legacy "password" column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') THEN
    EXECUTE 'UPDATE public.users SET password_hash = crypt(password, gen_salt(''bf'')) WHERE password_hash IS NULL';
    EXECUTE 'ALTER TABLE public.users DROP COLUMN password';
  END IF;
END $$;

-- 6. SEED DEFAULT TABLES (id stable so re-running this script is safe)
INSERT INTO public.tables ("id", "name", "type", "hourlyRate", "ratePerGame", "active", "sortOrder")
VALUES
  ('royal-magnum', 'Royal Magnum', 'royal', 90, 40, true, 0),
  ('royal-stroon', 'Royal Stroon', 'royal', 90, 40, true, 1),
  ('mini-1', 'Mini 1', 'mini', 60, 20, true, 2),
  ('mini-2', 'Mini 2', 'mini', 60, 20, true, 3)
ON CONFLICT ("id") DO NOTHING;

-- 7. DAILY SESSION NUMBERING (resets to 1 automatically whenever the date changes)
CREATE OR REPLACE FUNCTION public.assign_day_session_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number int;
BEGIN
  INSERT INTO public.day_counters ("date", "counter")
  VALUES (NEW."date", 1)
  ON CONFLICT ("date") DO UPDATE SET "counter" = public.day_counters."counter" + 1
  RETURNING "counter" INTO next_number;

  NEW."dayNumber" := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_day_session_number ON public.games;
CREATE TRIGGER trg_assign_day_session_number
  BEFORE INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.assign_day_session_number();

-- 8. SECURE LOGIN & USER CREATION (SECURITY DEFINER: the client never reads password_hash directly)
CREATE OR REPLACE FUNCTION public.verify_login(p_email text, p_password text)
RETURNS TABLE ("id" uuid, "email" text, "role" text, "allowedTables" text)
SECURITY DEFINER SET search_path = public AS $$
  SELECT u."id", u."email", u."role", u."allowedTables"
  FROM public.users u
  WHERE lower(u."email") = lower(p_email)
    AND u."password_hash" IS NOT NULL
    AND u."password_hash" = crypt(p_password, u."password_hash");
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.create_staff_user(p_email text, p_password text, p_role text, p_allowed_tables text)
RETURNS uuid
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.users ("email", "password_hash", "role", "allowedTables")
  VALUES (p_email, crypt(p_password, gen_salt('bf')), p_role, p_allowed_tables)
  RETURNING "id" INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.verify_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_login(text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_staff_user(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_staff_user(text, text, text, text) TO anon, authenticated;

-- 9. LOCK DOWN THE PASSWORD HASH COLUMN
-- The anon/authenticated roles can read the normal user columns (needed for the staff list
-- in Admin), but can NEVER select password_hash directly — only the SECURITY DEFINER
-- functions above (which run as the table owner) can see it.
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT ("id", "email", "role", "allowedTables", "created_at") ON public.users TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;

-- 10. ROW LEVEL SECURITY
-- This app is an internal, staff-only tool without per-user Supabase Auth sessions, so
-- policies below stay permissive at the row level for the shared anon key. The meaningful
-- fix in this script is #9 above (no more plaintext/hash leakage) plus removing the
-- hardcoded project credentials that used to live in the app's source code.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_users" ON public.users;
CREATE POLICY "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_games" ON public.games;
CREATE POLICY "allow_all_games" ON public.games FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_tables" ON public.tables;
CREATE POLICY "allow_all_tables" ON public.tables FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_day_counters" ON public.day_counters;
CREATE POLICY "allow_all_day_counters" ON public.day_counters FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_daily_summaries" ON public.daily_summaries;
CREATE POLICY "allow_all_daily_summaries" ON public.daily_summaries FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_app_config" ON public.app_config;
CREATE POLICY "allow_all_app_config" ON public.app_config FOR ALL USING (true) WITH CHECK (true);

-- 11. INITIAL DATA (default admin/user — CHANGE THESE PASSWORDS after first login!)
INSERT INTO public.users ("id", "email", "password_hash", "role")
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@snooker.club', crypt('admin', gen_salt('bf')), 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'user@snooker.club', crypt('user', gen_salt('bf')), 'user')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO public.app_config ("key", "value")
VALUES ('business_date', CURRENT_DATE::text)
ON CONFLICT ("key") DO NOTHING;

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- -----------------------------------------------------------------------------
-- DATA RESET SCRIPT (OPTIONAL - ONLY RUN THIS IF YOU WANT TO START NEW)
-- -----------------------------------------------------------------------------
-- DELETE FROM public.games;
-- DELETE FROM public.day_counters;
-- DELETE FROM public.daily_summaries;
-- UPDATE public.app_config SET value = CURRENT_DATE::text WHERE key = 'business_date';
`.trim();

const appsScriptCode = `
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), data.date, data.totalPaid, data.totalLoan, data.totalDiscount, data.gameCount]);
  return ContentService.createTextOutput("Success");
}
`.trim();

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { sheetUrl, spreadsheetViewUrl, saveSheetUrl, clearSheetUrl, refetchGames, isTableMissing, syncAllToGoogleSheets } = useGames();
  const [urlInput, setUrlInput] = useState(sheetUrl || '');
  const [viewUrlInput, setViewUrlInput] = useState(spreadsheetViewUrl || '');
  const [activeTab, setActiveTab] = useState<'supabase' | 'sheets'>('supabase');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [dbConfig, setDbConfig] = useState(() => getSupabaseConfig());
  const [dbUrlInput, setDbUrlInput] = useState(dbConfig.url);
  const [dbKeyInput, setDbKeyInput] = useState(dbConfig.anonKey);
  const [dbSaveMsg, setDbSaveMsg] = useState<string | null>(null);

  const handleSaveSupabase = () => {
    if (!dbUrlInput.trim() || !dbKeyInput.trim()) {
      setDbSaveMsg("Error: Les valeurs Supabase URL et Anon Key ne peuvent pas être vides.");
      return;
    }
    try {
      localStorage.setItem('supabase_url', dbUrlInput.trim());
      localStorage.setItem('supabase_anon_key', dbKeyInput.trim());
      setDbSaveMsg("Succès ! Sauvegarde en cours, l'application va redémarrer...");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDbSaveMsg(`Erreur lors de la sauvegarde : ${err.message || err}`);
    }
  };

  const handleResetSupabase = () => {
    try {
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_anon_key');
      setDbSaveMsg("Restauration du projet par défaut, l'application va redémarrer...");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setDbSaveMsg(`Erreur lors de la réinitialisation : ${err.message || err}`);
    }
  };

  useEffect(() => {
    if (isTableMissing) setActiveTab('supabase');
  }, [isTableMissing]);

  useEffect(() => {
    setUrlInput(sheetUrl || '');
    setViewUrlInput(spreadsheetViewUrl || '');
    setSyncMsg(null);
  }, [sheetUrl, spreadsheetViewUrl]);

  const handleSave = () => {
    if (urlInput) {
      saveSheetUrl(urlInput, viewUrlInput);
      onClose();
      setTimeout(refetchGames, 100); 
    }
  };
  
  const handleDisconnect = () => {
      clearSheetUrl();
      setUrlInput('');
      setViewUrlInput('');
      setSyncMsg(null);
      onClose();
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncMsg(null);
    try {
      const res = await syncAllToGoogleSheets();
      if (res.success) {
        setSyncMsg(`Succès ! Synchronisation de ${res.count} rapports de clôture effectuée.`);
      } else {
        setSyncMsg(`Échec de la synchronisation : ${res.error}`);
      }
    } catch (err: any) {
      setSyncMsg(`Échec de la synchronisation : ${err.message || err}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-3">
             <h2 className="text-lg font-semibold">System Settings</h2>
             <div className="flex bg-muted rounded-md p-0.5">
                <button 
                    onClick={() => setActiveTab('supabase')} 
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${activeTab === 'supabase' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >Database Fix {isTableMissing && "⚠️"}</button>
                <button 
                    onClick={() => setActiveTab('sheets')} 
                    className={`px-3 py-1 text-xs rounded-sm transition-all ${activeTab === 'sheets' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >Google Sheets</button>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><CloseIcon /></Button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
            {activeTab === 'supabase' ? (
                <div className="space-y-6">
                    <Card className="border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/5">
                        <CardContent className="p-4 space-y-4">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                <DatabaseIcon className="h-5 w-5" />
                                <span>Connexion de Base de Données Supabase</span>
                            </div>
                            
                            <div className="grid w-full gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-muted-foreground">Supabase URL</label>
                                     <Input 
                                         type="url" 
                                         placeholder="https://your-project.supabase.co" 
                                         value={dbUrlInput} 
                                         onChange={e => setDbUrlInput(e.target.value)} 
                                     />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-xs font-bold text-muted-foreground">Supabase Anon Key</label>
                                     <Input 
                                         type="password" 
                                         placeholder="your-anon-key" 
                                         value={dbKeyInput} 
                                         onChange={e => setDbKeyInput(e.target.value)} 
                                     />
                                 </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                 <Button onClick={handleSaveSupabase} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase">
                                     Sauvegarder la Connexion
                                 </Button>
                                 {dbConfig.isCustom && (
                                     <Button onClick={handleResetSupabase} variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive font-bold text-xs uppercase">
                                         Réinitialiser
                                     </Button>
                                 )}
                             </div>

                             {dbSaveMsg && (
                                 <p className={`text-xs font-bold ${dbSaveMsg.includes('Succès') ? 'text-emerald-600' : 'text-destructive'}`}>
                                     {dbSaveMsg}
                                 </p>
                             )}

                             <div className="text-[10px] text-muted-foreground bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-dashed flex justify-between items-center">
                                 <span>Source configuration actuelle :</span>
                                 <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] uppercase ${dbConfig.isCustom ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'}`}>
                                     {dbConfig.isCustom ? 'Config Personnalisée' : 'Projet par Défaut'}
                                 </span>
                             </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/50 bg-primary/5">
                        <CardContent className="p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span>Script de Réparation & Initialisation SQL</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Si vous connectez un nouveau projet Supabase ou rencontrez des erreurs de colonnes manquantes (ex: <code>is_paid</code> ou <code>total_loan</code>), vous devez exécuter le script SQL ci-dessous dans l'éditeur SQL de votre projet Supabase.
                            </p>
                            <Button size="sm" className="w-full sm:w-auto self-start text-xs font-bold" variant="default" asChild>
                                <a 
                                    href={`https://supabase.com/dashboard/project/${(() => {
                                        try {
                                            const host = new URL(dbUrlInput).hostname;
                                            return host.split('.')[0];
                                        } catch {
                                            return 'eyhlvfbmflbmhiactefk';
                                        }
                                    })()}/sql/new`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                >
                                    Ouvrir l'éditeur SQL Supabase ↗
                                </a>
                            </Button>
                        </CardContent>
                    </Card>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-xs uppercase tracking-widest opacity-60">Master Repair Script</h4>
                        </div>
                        <CodeBlock code={supabaseSql} />
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg text-green-600">Google Sheets Connection</h3>
                        <p className="text-sm text-muted-foreground">
                            Automatically backup every daily summary to a spreadsheet.
                        </p>
                    </div>

                    <Card>
                        <CardContent className="p-4 space-y-4">
                             <div className="grid w-full items-center gap-1.5">
                                <label className="text-sm font-medium">Deployment URL</label>
                                <Input type="url" placeholder="https://script.google.com/.../exec" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
                            </div>

                            <div className="grid w-full items-center gap-1.5">
                                <label className="text-sm font-medium">Spreadsheet Browser URL</label>
                                <Input type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={viewUrlInput} onChange={e => setViewUrlInput(e.target.value)} />
                            </div>

                            <div className="flex gap-2 w-full pt-2">
                                <Button onClick={handleSave} className="flex-1">Save Connection</Button>
                                {sheetUrl && <Button onClick={handleDisconnect} variant="destructive">Disconnect</Button>}
                            </div>

                            {sheetUrl && (
                              <div className="pt-4 border-t space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Opérations de Synchronisation</h4>
                                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-dashed">
                                  <div className="text-left">
                                    <p className="text-xs font-bold text-foreground">Sauvegarder tout l'historique</p>
                                    <p className="text-[10px] text-muted-foreground">Envoyer tous les rapports de clôture déjà présents dans Supabase vers votre Google Sheet.</p>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    onClick={handleSyncAll} 
                                    disabled={isSyncingAll}
                                    className="font-black uppercase text-[10px] bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                                  >
                                    {isSyncingAll ? (
                                      <>
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        Sync en cours...
                                      </>
                                    ) : (
                                      "Sauvegarder maintenant"
                                    )}
                                  </Button>
                                </div>
                                {syncMsg && (
                                  <p className={`text-xs font-bold ${syncMsg.includes('Succès') ? 'text-green-600' : 'text-destructive'}`}>
                                    {syncMsg}
                                  </p>
                                )}
                              </div>
                            )}
                        </CardContent>
                    </Card>

                    <div>
                        <h3 className="font-semibold text-sm mb-2 opacity-60">Apps Script Template</h3>
                        <CodeBlock code={appsScriptCode} />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
