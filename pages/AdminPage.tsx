
import React, { useState, useMemo, useEffect } from 'react';
import { Game, PaymentStatus, GameStatus, DailySummary } from '../types';
import GamesTable from '../components/GamesTable';
import KpiCard from '../components/KpiCard';
import { formatCurrency } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { DollarSignIcon, HashIcon, ClockIcon, AlertTriangle, TrophyIcon, UsersIcon, LoaderCircle, CheckCircle, CalendarIcon } from '../components/icons';
import PrintResumeButton from '../components/PrintResumeButton';
import { useAuth } from '../hooks/useAuth';
import { useGames } from '../hooks/useGames';
import { useBusinessDay } from '../hooks/useBusinessDay';
import UserManagement from '../components/UserManagement';
import AnalyticsCard from '../components/AnalyticsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import DailyClosureReport from '../components/DailyClosureReport';
import { AIAuditorWidget } from '../components/AIAuditorWidget';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { games, updateGame, deleteGame, saveDailySummary, resetDatabase, error: gameError } = useGames();
  const { businessDate, advanceDay } = useBusinessDay();
  
  // Range states
  const [startDate, setStartDate] = useState(businessDate);
  const [endDate, setEndDate] = useState(businessDate);
  
  const [isArchiving, setIsArchiving] = useState(false);
  const [showClosureReport, setShowClosureReport] = useState(false);
  const [closureDate, setClosureDate] = useState('');
  const [closureEndDate, setClosureEndDate] = useState('');
  const [closureGames, setClosureGames] = useState<Game[]>([]);
  
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingSettleId, setPendingSettleId] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState(false);

  const REQUIRED_RESET_PASSWORD = '753159';

  useEffect(() => {
    setStartDate(businessDate);
    setEndDate(businessDate);
  }, [businessDate]);

  const isLiveDay = startDate === businessDate && endDate === businessDate;
  const isRange = startDate !== endDate;

  const filteredGames = useMemo(() => {
    return games
      .filter(game => game.date >= startDate && game.date <= endDate)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [games, startDate, endDate]);
  
  const rangeStats = useMemo(() => {
    const incomePaid = filteredGames
      .filter(g => g.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, g) => sum + (g.finalPriceMAD || 0), 0);
    
    const dayLoans = filteredGames
      .filter(g => g.paymentStatus === PaymentStatus.LOAN)
      .reduce((sum, g) => sum + (g.finalPriceMAD || 0), 0);

    const discounts = filteredGames
      .reduce((sum, g) => sum + (g.discountMAD || 0), 0);

    return {
      totalGames: filteredGames.length,
      incomePaid,
      dayLoans,
      discounts,
      runningCount: filteredGames.filter(g => g.status === GameStatus.RUNNING).length
    };
  }, [filteredGames]);

  const globalOutstandingLoans = useMemo(() => {
      return games
        .filter(g => g.paymentStatus === PaymentStatus.LOAN)
        .reduce((sum, g) => sum + (g.finalPriceMAD || 0), 0);
  }, [games]);

  const allLoansList = useMemo(() => {
    return games
      .filter(g => g.paymentStatus === PaymentStatus.LOAN)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [games]);

  const getDebtorName = (loan: Game) => {
    if (!loan.player2) return loan.player1;
    if (loan.winner === loan.player1) return loan.player2;
    if (loan.winner === loan.player2) return loan.player1;
    return loan.player1;
  };

  const analyticsData = useMemo(() => {
    const playerStats: { [key: string]: { paid: number; loan: number; wins: number } } = {};

    const addPlayerStat = (player: string | null, key: 'paid' | 'loan', value: number) => {
        if (!player || value <= 0) return;
        if (!playerStats[player]) {
            playerStats[player] = { paid: 0, loan: 0, wins: 0 };
        }
        playerStats[player][key] += value;
    };

    games.forEach(game => {
        if (game.status !== GameStatus.FINISHED || !game.finalPriceMAD) return;
        const { player1, player2, winner, finalPriceMAD, paymentStatus } = game;
        if (paymentStatus === PaymentStatus.PAID) {
            const amount = player2 ? finalPriceMAD / 2 : finalPriceMAD;
            addPlayerStat(player1, 'paid', amount);
            addPlayerStat(player2, 'paid', amount);
        } else if (paymentStatus === PaymentStatus.LOAN) {
            const loanee = getDebtorName(game);
            addPlayerStat(loanee, 'loan', finalPriceMAD);
        }
        if (winner) {
            if (!playerStats[winner]) playerStats[winner] = { paid: 0, loan: 0, wins: 0 };
            playerStats[winner].wins += 1;
        }
    });

    const allPlayers = Object.entries(playerStats).map(([name, stats]) => ({ name, ...stats }));
    const topWinners = [...allPlayers].sort((a, b) => b.wins - a.wins).filter(p => p.wins > 0).slice(0, 5);
    const topPaid = [...allPlayers].sort((a, b) => b.paid - a.paid).filter(p => p.paid > 0).slice(0, 5);
    const playersWithLoans = [...allPlayers].sort((a, b) => b.loan - a.loan).filter(p => p.loan > 0);
    return { topWinners, topPaid, playersWithLoans };
  }, [games]);
  
  const performArchive = async () => {
    if (isArchiving) return;
    
    setIsArchiving(true);
    setArchiveError(null);
    const reportDate = businessDate;
    const reportGames = [...filteredGames];
    
    try {
      const summary: DailySummary = {
        date: businessDate,
        totalPaid: rangeStats.incomePaid,
        totalLoan: rangeStats.dayLoans,
        totalDiscount: rangeStats.discounts,
        gameCount: rangeStats.totalGames,
      };
      
      await saveDailySummary(summary);
      await advanceDay(); 
      
      setIsConfirmingArchive(false);
      setClosureDate(reportDate);
      setClosureEndDate(reportDate);
      setClosureGames(reportGames);
      setShowClosureReport(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      console.error("Échec critique de l'archivage :", e);
      setArchiveError(`ERREUR : ${e.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleArchiveClick = () => {
    if (rangeStats.runningCount > 0) {
        alert(`IMPOSSIBLE DE TERMINER : Il reste ${rangeStats.runningCount} table(s) active(s).`);
        return;
    }
    setIsConfirmingArchive(true);
  };

  const settleLoan = async (gameId: string) => {
    try {
        await updateGame(gameId, { paymentStatus: PaymentStatus.PAID });
        setPendingSettleId(null);
    } catch (e) {
        console.error("Échec du règlement du crédit", e);
    }
  };

  const handleFactoryReset = async () => {
    if (resetPassword !== REQUIRED_RESET_PASSWORD) {
        setResetPasswordError(true);
        return;
    }
    setResetLoading(true);
    try {
        await resetDatabase();
        setShowResetConfirm(false);
        setResetPassword('');
        window.location.reload();
    } finally {
        setResetLoading(false);
    }
  };

  if (!user) return null;

  if (showClosureReport) {
      return (
        <DailyClosureReport 
            date={closureDate} 
            endDate={closureEndDate}
            games={closureGames} 
            onBack={() => setShowClosureReport(false)} 
        />
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pt-6">
      <AIAuditorWidget />
      
      <div className="flex flex-col gap-6 border-b pb-8 px-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">Contrôle Admin</h1>
            <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest opacity-70">Gestion du Club & Analyses</p>
          </div>
          <div className="flex items-center gap-2">
             {isLiveDay ? (
                <Badge className="bg-green-600 hover:bg-green-600 animate-pulse border-none px-3 py-1 text-[10px] font-black">SESSION EN DIRECT</Badge>
            ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-600 px-3 py-1 text-[10px] font-black uppercase">
                    {isRange ? "Période Personnalisée" : "Archive"}
                </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
           <div className="flex items-center gap-3 text-sm">
             <CalendarIcon className="h-4 w-4 text-primary" />
             <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-muted-foreground">Période :</span>
                <span className="font-bold border-b-2 border-primary/20 pb-0.5">
                    {new Date(startDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    {isRange && ` au ${new Date(endDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </span>
             </div>
           </div>
           
           <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-muted/40 p-3 rounded-2xl border w-full lg:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase text-muted-foreground min-w-[30px]">Du :</span>
                <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="flex-1 sm:w-[140px] bg-background h-10 sm:h-8 text-xs font-bold border-none shadow-none"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-2 border-t sm:border-t-0 sm:border-l pt-2 sm:pt-0 sm:pl-3 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase text-muted-foreground min-w-[30px]">Au :</span>
                <Input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="flex-1 sm:w-[140px] bg-background h-10 sm:h-8 text-xs font-bold border-none shadow-none"
                />
              </div>
              <Button size="sm" variant="ghost" className="h-10 sm:h-8 text-[10px] font-black uppercase w-full sm:w-auto mt-1 sm:mt-0" onClick={() => { setStartDate(businessDate); setEndDate(businessDate); }}>
                  Aujourd'hui
              </Button>
           </div>
        </div>
      </div>

      {(gameError || archiveError) && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex flex-col gap-2 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0"/>
                <span className="text-xs font-black uppercase">Échec de l'opération</span>
            </div>
            <p className="text-xs font-bold pl-8">{archiveError || `Alerte Sync : ${gameError}`}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Parties Total" value={rangeStats.totalGames.toString()} icon={<HashIcon />} />
        <KpiCard title="Total Espèces" value={`${rangeStats.incomePaid.toFixed(2)}`} icon={<DollarSignIcon />} />
        <KpiCard title="Total Crédits" value={`${rangeStats.dayLoans.toFixed(2)}`} icon={<ClockIcon />} />
        <KpiCard title="Dette Globale" value={`${globalOutstandingLoans.toFixed(2)}`} icon={<AlertTriangle className="text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 shadow-sm border-dashed">
              <CardHeader className="bg-muted/10 pb-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bilan de la Période</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6">
                  <div className="flex items-center justify-between p-3 border-2 border-green-500/10 rounded-xl bg-green-50/30">
                      <span className="text-[10px] font-black uppercase text-green-600/70">Encaissement :</span>
                      <span className="font-black text-green-600">{formatCurrency(rangeStats.incomePaid)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border-2 border-amber-500/10 rounded-xl bg-amber-50/30">
                      <span className="text-[10px] font-black uppercase text-amber-600/70">Crédits Émis :</span>
                      <span className="font-black text-amber-600">{formatCurrency(rangeStats.dayLoans)}</span>
                  </div>
                  <div className="pt-4 border-t-2 border-zinc-900 mt-2">
                      <div className="flex justify-between items-center px-1">
                          <span className="font-black text-xs uppercase tracking-widest">Total Chiffre :</span>
                          <span className="text-xl font-black">{formatCurrency(rangeStats.incomePaid + rangeStats.dayLoans)}</span>
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="col-span-1 md:col-span-2 border-amber-200 dark:border-amber-900/50 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between bg-amber-50/50 dark:bg-amber-950/10 pb-4">
                  <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest">
                      <ClockIcon className="h-4 w-4" />
                      Tous les Crédits en Cours
                  </CardTitle>
                  <Badge className="bg-amber-500 font-bold text-[10px]">{allLoansList.length} Crédits</Badge>
              </CardHeader>
              <CardContent className="h-[280px] overflow-y-auto pt-4 p-0">
                  {allLoansList.length > 0 ? (
                    <div className="divide-y divide-amber-100/50">
                        {allLoansList.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between p-4 hover:bg-amber-50/20 transition-all">
                                <div className="grid gap-0.5">
                                    <span className="font-black text-xs text-foreground uppercase tracking-tight">
                                        {getDebtorName(loan)}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <span className="font-bold text-amber-600/80">{loan.tableName}</span>
                                        <span>•</span>
                                        <span>{new Date(loan.date + 'T00:00:00').toLocaleDateString('fr-FR')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-sm text-amber-600">{formatCurrency(loan.finalPriceMAD)}</span>
                                    {pendingSettleId === loan.id ? (
                                        <div className="flex items-center gap-1.5 animate-in zoom-in-95 duration-200">
                                            <Button size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase border-green-600 text-green-600 hover:bg-green-600/10 px-2 rounded-xl" onClick={() => settleLoan(loan.id)}>
                                                Oui
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 text-[9px] font-black uppercase text-muted-foreground px-2 rounded-xl" onClick={() => setPendingSettleId(null)}>
                                                Non
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-8 sm:w-8 text-green-600 rounded-full hover:bg-green-500/10 flex items-center justify-center" onClick={() => setPendingSettleId(loan.id)}>
                                            <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-50 py-10">
                        <CheckCircle className="h-10 w-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aucune dette</p>
                    </div>
                  )}
              </CardContent>
          </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
            <h2 className="text-xl font-black uppercase tracking-tighter">Historique de la Période</h2>
            <div className="flex flex-wrap items-center gap-2">
                <PrintResumeButton games={filteredGames} startDate={startDate} endDate={endDate} />
                
                {isLiveDay && (
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        {isConfirmingArchive ? (
                            <div className="flex items-center gap-2 p-2 bg-primary text-primary-foreground rounded-xl shadow-xl animate-in fade-in zoom-in border-2 border-white">
                                <span className="text-[10px] font-black uppercase px-2">Archiver aujourd'hui ?</span>
                                <Button size="sm" variant="secondary" className="h-8 font-black uppercase text-[10px]" onClick={performArchive} disabled={isArchiving}>Oui</Button>
                                <Button size="sm" variant="ghost" className="h-8 font-black uppercase text-[10px] text-white" onClick={() => setIsConfirmingArchive(false)}>Non</Button>
                            </div>
                        ) : (
                            <Button onClick={handleArchiveClick} className="bg-primary font-black uppercase tracking-widest px-6 shadow-xl h-10 text-xs">
                                Clôturer Session
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
        <GamesTable 
            games={filteredGames} 
            isAdmin={true} 
            updateGame={updateGame} 
            deleteGame={deleteGame}
            currentUserId={user.id}
        />
      </div>

      <div className="pt-12 border-t">
        <h2 className="text-xl font-black uppercase tracking-tighter mb-6">Gestion des Utilisateurs</h2>
        <UserManagement />
      </div>

      {/* ZONE DE DANGER */}
      <div className="pt-16 pb-12">
        <div className="bg-destructive/5 border-2 border-destructive/20 rounded-3xl p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight text-destructive">Zone de Danger</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                        Réinitialisation complète du système. Cela supprimera toutes les parties et résumés.
                    </p>
                </div>
                
                {showResetConfirm ? (
                    <div className="flex flex-col gap-3 animate-in slide-in-from-right-4">
                        <Input 
                            type="password" 
                            placeholder="Code Sécurité" 
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="h-10 text-center font-black"
                        />
                        <div className="flex gap-2">
                            <Button variant="destructive" className="font-black uppercase text-[10px]" onClick={handleFactoryReset} disabled={resetLoading}>Confirmer</Button>
                            <Button variant="outline" className="text-[10px] font-black uppercase" onClick={() => setShowResetConfirm(false)}>Annuler</Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="outline" className="border-destructive text-destructive font-black uppercase tracking-widest h-10 text-xs" onClick={() => setShowResetConfirm(true)}>
                        Réinitialiser Données
                    </Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
