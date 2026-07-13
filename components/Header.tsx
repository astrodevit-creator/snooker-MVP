
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';
import { Role } from '../types';
import ThemeToggle from './ThemeToggle';
import { SettingsIcon, CheckCircle, AlertTriangle, LoaderCircle, ExternalLinkIcon, DatabaseIcon, BellIcon, SparklesIcon } from './icons';
import SettingsModal from './SettingsModal';
import { useGames } from '../hooks/useGames';
import { useAIAuditor } from '../hooks/useAIAuditor';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { syncStatus, sheetUrl, spreadsheetViewUrl, isLoading } = useGames();
  const { alerts, alertCount, triggerSound } = useAIAuditor();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);

  const SyncIndicator = () => {
    return (
      <div className="hidden md:flex items-center gap-4">
        {/* Supabase Status */}
        <div className="flex items-center gap-2 text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
          <DatabaseIcon className="h-3 w-3" />
          <span className="hidden lg:inline">Supabase Live</span>
        </div>

        {/* Sheets Sync (If active) */}
        {sheetUrl && (
          <div className="flex items-center gap-2 text-xs">
             {syncStatus === 'syncing' ? <LoaderCircle className="h-3 w-3 animate-spin text-primary" /> : <CheckCircle className="h-3 w-3 text-green-500" />}
             <span className="text-muted-foreground hidden sm:inline">Sheets Synced</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center mx-auto px-4">
        <div className="flex items-center">
          <Link to="/" className="mr-4 flex items-center space-x-2 sm:mr-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6">
                <rect width="256" height="256" fill="none"></rect>
                <circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"></circle>
                <circle cx="128" cy="128" r="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"></circle>
            </svg>
            <span className="hidden font-bold sm:inline-block">Snooker Club</span>
          </Link>
          {user && (
             <nav className="flex items-center gap-2 text-xs sm:text-sm sm:gap-4 font-semibold">
                {user.role === Role.ADMIN && <Link to="/admin" className="transition-colors hover:text-foreground/80 text-foreground/60">Admin</Link>}
                <Link to="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">
                  <span className="hidden sm:inline">Tableau de Bord</span>
                  <span className="sm:hidden">Tableau</span>
                </Link>
            </nav>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end space-x-1.5 sm:space-x-4">
          <SyncIndicator />
          {spreadsheetViewUrl && (
             <Button variant="ghost" size="icon" asChild title="Ouvrir Google Sheet" className="hidden sm:inline-flex">
                <a href={spreadsheetViewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="h-4 w-4" />
                </a>
             </Button>
          )}
          <ThemeToggle />

          {/* AI Auditor Notification Bell */}
          {user && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAuditorOpen(!isAuditorOpen)}
                className={`relative h-9 w-9 rounded-xl border transition-all ${
                  alertCount > 0
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 border-red-500/30 animate-pulse'
                    : 'bg-muted/10 border-transparent hover:bg-muted/20 text-muted-foreground'
                }`}
                title="Contrôleur IA - Alertes de dépassement"
              >
                <BellIcon className="h-5 w-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-background animate-bounce shadow-md">
                    {alertCount}
                  </span>
                )}
              </Button>

              {isAuditorOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsAuditorOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 md:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card text-card-foreground shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex items-center justify-between border-b pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-amber-500 animate-pulse" />
                        <h4 className="font-black text-xs uppercase tracking-widest text-foreground">Contrôleur IA</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-1 h-6 hover:bg-muted rounded-md border transition-all" 
                          onClick={triggerSound}
                        >
                          Test Son
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${alertCount > 0 ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}`}>
                          {alertCount > 0 ? `${alertCount} Alerte` : 'R.A.S.'}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                      {alerts.length > 0 ? (
                        alerts.map((alert) => (
                          <div key={alert.id} className="p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 transition-all text-left">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-xs font-black uppercase text-foreground">
                                  {alert.game.tableName}
                                </span>
                                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                  Joueur : <span className="text-foreground uppercase">{alert.game.player1}</span>
                                </p>
                              </div>
                              <span className="text-[10px] font-black bg-red-500/10 text-red-600 px-2 py-0.5 rounded border border-red-500/20">
                                +{Math.floor(alert.excessMinutes)} min
                              </span>
                            </div>

                            <div className="mt-2 text-[10px] font-medium leading-relaxed bg-background/50 p-2 rounded-lg border border-red-500/10 text-red-800 dark:text-red-300">
                              {alert.recommendation}
                            </div>
                            
                            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground font-bold">
                              <span>Limite : {alert.thresholdMinutes}m</span>
                              <span>Temps écoulé : {Math.floor(alert.elapsedMinutes)}m</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground space-y-2">
                          <CheckCircle className="h-8 w-8 text-green-500 opacity-60" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-foreground">Aucun dépassement</p>
                            <p className="text-[10px] mt-0.5 max-w-[250px] mx-auto">Toutes les tables respectent les limites d'audit (Mini &lt; 25m, Royal &lt; 45m).</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Uniquement pour les admins */}
          {user?.role === Role.ADMIN && (
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Paramètres de connexion" className="hidden sm:inline-flex">
              <SettingsIcon className="h-5 w-5" />
            </Button>
          )}

          {user ? (
            <>
              <div className="text-right ml-2 hidden sm:block">
                <p className="hidden text-sm font-medium leading-none sm:block">{user.email}</p>
                <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
              </div>
              <Button onClick={logout} variant="outline" size="sm" className="h-9 px-2 sm:px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-border">
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sm:hidden">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </span>
              </Button>
            </>
          ) : (
             <Button asChild variant="outline" size="sm">
                <Link to="/auth">Connexion</Link>
             </Button>
          )}
        </div>
      </div>
    </header>
    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default Header;
