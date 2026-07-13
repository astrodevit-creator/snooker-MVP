
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
-- SNOOKER CLUB MANAGER - SCHEMA REPAIR & INITIALIZATION
-- Run this in your Supabase SQL Editor to fix missing columns

-- 1. ENSURE BASE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.users (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text UNIQUE NOT NULL,
  "password" text NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('admin', 'user')),
  "allowedTables" text,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.games (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  "tableName" text NOT NULL,
  "hourlyRate" numeric NOT NULL,
  "startTime" timestamptz NOT NULL,
  "endTime" timestamptz,
  "player1" text NOT NULL,
  "player2" text,
  "winner" text,
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

-- 4. PERMISSIONS & REALTIME
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.games DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config DISABLE ROW LEVEL SECURITY;

-- 5. INITIAL DATA
INSERT INTO public.users ("id", "email", "password", "role") 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@snooker.club', 'admin', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'user@snooker.club', 'user', 'user')
ON CONFLICT ("email") DO UPDATE SET "id" = EXCLUDED."id";

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
