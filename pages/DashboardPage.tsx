
import React, { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGames } from '../hooks/useGames';
import { useBusinessDay } from '../hooks/useBusinessDay';
import GamesTable from '../components/GamesTable';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { TABLES, DEFAULT_HOURLY_RATE } from '../constants';
import { GameStatus, PaymentStatus, Game } from '../types';
import { AlertTriangle, ClockIcon, CheckCircle, UsersIcon, DollarSignIcon } from '../components/icons';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../lib/utils';
import { AIAuditorWidget } from '../components/AIAuditorWidget';
import KpiCard from '../components/KpiCard';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { games, addGame, updateGame, isTableMissing } = useGames();
  const { businessDate } = useBusinessDay();
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [gamesCount, setGamesCount] = useState('1');
  
  const busyTableNames = useMemo(() => {
    return games
      .filter(g => g.status === GameStatus.RUNNING)
      .map(g => g.tableName);
  }, [games]);

  const handleStartGame = () => {
    if (!player1 || !user) {
      alert('Le nom du joueur 1 est requis.');
      return;
    }
    
    if (!selectedTableId) {
      alert('Veuillez sélectionner une table.');
      return;
    }

    const tableConfig = TABLES.find(t => t.id === selectedTableId);
    const tableName = tableConfig ? tableConfig.name : 'Inconnue';
    const hourlyRate = tableConfig ? tableConfig.rate : DEFAULT_HOURLY_RATE;
    
    const isTableBusy = games.some(g => g.tableName === tableName && g.status === GameStatus.RUNNING);
    
    if (isTableBusy) {
      alert(`La table "${tableName}" est déjà occupée.`);
      return;
    }
    
    addGame({
      date: businessDate,
      tableName: tableName,
      hourlyRate: hourlyRate,
      startTime: new Date().toISOString(),
      endTime: null,
      player1,
      player2: player2 || null,
      winner: null,
      status: GameStatus.RUNNING,
      durationSeconds: null,
      priceMAD: null,
      discountMAD: 0,
      finalPriceMAD: null,
      paymentStatus: PaymentStatus.PENDING,
      notes: gamesCount,
      createdBy: user.id,
      modifiedBy: null,
    });

    setPlayer1('');
    setPlayer2('');
    setSelectedTableId('');
    setGamesCount('1');
  };

  const getDebtorName = (loan: Game) => {
    if (!loan.player2) return loan.player1;
    if (loan.winner === loan.player1) return loan.player2;
    if (loan.winner === loan.player2) return loan.player1;
    return loan.player1;
  };
  
  const allowedTablesList = useMemo(() => {
    if (!user) return TABLES;
    if (user.role === 'admin') return TABLES;
    if (user.allowedTables) {
      const allowedNames = user.allowedTables.split(',').map(s => s.trim().toLowerCase());
      return TABLES.filter(t => allowedNames.includes(t.name.trim().toLowerCase()));
    }
    return TABLES;
  }, [user]);

  const allLoansList = useMemo(() => {
    return games
      .filter(g => {
        if (g.paymentStatus !== PaymentStatus.LOAN) return false;
        if (user && user.role !== 'admin' && user.allowedTables) {
          const allowedNames = user.allowedTables.split(',').map(s => s.trim().toLowerCase());
          return allowedNames.includes(g.tableName.trim().toLowerCase());
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [games, user]);

  const myCurrentSessionGames = useMemo(() => {
    return games.filter(game => {
      if (game.createdBy !== user?.id || game.date !== businessDate) return false;
      if (user && user.role !== 'admin' && user.allowedTables) {
        const allowedNames = user.allowedTables.split(',').map(s => s.trim().toLowerCase());
        return allowedNames.includes(game.tableName.trim().toLowerCase());
      }
      return true;
    });
  }, [games, user, businessDate]);

  const allDayGames = useMemo(() => {
    return games.filter(g => {
      if (g.date !== businessDate) return false;
      if (user && user.role !== 'admin' && user.allowedTables) {
        const allowedNames = user.allowedTables.split(',').map(s => s.trim().toLowerCase());
        return allowedNames.includes(g.tableName.trim().toLowerCase());
      }
      return true;
    });
  }, [games, businessDate, user]);

  const shiftStats = useMemo(() => {
    const myTotalPaid = myCurrentSessionGames
      .filter(g => g.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, g) => sum + (g.finalPriceMAD ?? 0), 0);
    const myTotalLoan = myCurrentSessionGames
      .filter(g => g.paymentStatus === PaymentStatus.LOAN)
      .reduce((sum, g) => sum + (g.finalPriceMAD ?? 0), 0);

    const dayTotalPaid = allDayGames
      .filter(g => g.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, g) => sum + (g.finalPriceMAD ?? 0), 0);
    const dayTotalLoan = allDayGames
      .filter(g => g.paymentStatus === PaymentStatus.LOAN)
      .reduce((sum, g) => sum + (g.finalPriceMAD ?? 0), 0);

    return { myTotalPaid, myTotalLoan, dayTotalPaid, dayTotalLoan };
  }, [myCurrentSessionGames, allDayGames]);

  const formattedDate = new Date(businessDate + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Tableau de Bord</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClockIcon className="h-4 w-4" />
            <span className="text-sm font-bold">Session : <span className="text-foreground underline decoration-primary/30 underline-offset-4">{formattedDate}</span></span>
          </div>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-4 py-1.5 uppercase tracking-widest text-[10px]">
            {allDayGames.length} Parties aujourd'hui
        </Badge>
      </div>

      <AIAuditorWidget />

      {/* Financial Shift Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Mon Encaissement" 
          value={formatCurrency(shiftStats.myTotalPaid)} 
          icon={<DollarSignIcon className="text-green-500" />} 
        />
        <KpiCard 
          title="Mes Crédits Émis" 
          value={formatCurrency(shiftStats.myTotalLoan)} 
          icon={<ClockIcon className="text-amber-500" />} 
        />
        <KpiCard 
          title="Encaissement Club" 
          value={formatCurrency(shiftStats.dayTotalPaid)} 
          icon={<DollarSignIcon className="text-zinc-500" />} 
        />
        <KpiCard 
          title="Crédits Club" 
          value={formatCurrency(shiftStats.dayTotalLoan)} 
          icon={<ClockIcon className="text-zinc-500" />} 
        />
      </div>

      {isTableMissing && (
        <Card className="border-destructive bg-destructive/10 border-2 shadow-lg">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
            <div className="flex-1">
              <p className="font-black text-destructive uppercase tracking-tight">Base de données hors ligne</p>
              <p className="text-xs font-bold opacity-80 uppercase tracking-tight">Configuration requise : Ouvrez les paramètres pour initialiser Supabase.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-2 shadow-sm border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="bg-muted/30 px-6 py-4 border-b">
                <h2 className="text-sm font-black uppercase tracking-widest">Nouvelle partie</h2>
            </div>
            <CardContent className="p-6">
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 items-end">
                <div className="grid w-full items-center gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Joueur 1 (Obligatoire)</label>
                    <Input type="text" placeholder="Nom" value={player1} onChange={e => setPlayer1(e.target.value)} disabled={isTableMissing} className="h-12 font-bold" />
                </div>
                <div className="grid w-full items-center gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Joueur 2 (Optionnel)</label>
                    <Input type="text" placeholder="Nom" value={player2} onChange={e => setPlayer2(e.target.value)} disabled={isTableMissing} className="h-12 font-bold" />
                </div>
                <div className="grid w-full items-center gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Table</label>
                    <Select value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)} disabled={isTableMissing} className="w-full h-12 font-bold">
                    <option value="" disabled>Choisir table...</option>
                    {allowedTablesList.map(t => {
                        const isBusy = busyTableNames.includes(t.name);
                        return (
                        <option key={t.id} value={t.id} disabled={isBusy}>
                            {t.name} — {t.rate} MAD / Partie {isBusy ? '(OCCUPÉE)' : ''}
                        </option>
                        );
                    })}
                    </Select>
                </div>
                <div className="grid w-full items-center gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-1">Nombre de parties</label>
                    <Select value={gamesCount} onChange={e => setGamesCount(e.target.value)} disabled={isTableMissing} className="w-full h-12 font-bold">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => (
                        <option key={n} value={String(n)}>{n} {n === 1 ? 'partie' : 'parties'}</option>
                      ))}
                    </Select>
                </div>
                <div className="sm:col-span-2 w-full pt-2">
                    <Button onClick={handleStartGame} disabled={isTableMissing || !player1 || !selectedTableId} className="h-12 px-10 font-black uppercase tracking-widest bg-primary shadow-xl w-full">
                        Démarrer la Session
                    </Button>
                </div>
            </div>
            </CardContent>
        </Card>

        {/* LISTE DES IMPAYÉS (SUIVI DES CRÉDITS) */}
        <Card className="border-amber-200 dark:border-amber-900/50 shadow-md h-full bg-amber-50/10">
            <CardHeader className="bg-amber-50/50 dark:bg-amber-950/10 border-b border-amber-200/50">
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest">
                    <AlertTriangle className="h-4 w-4" />
                    Suivi des Crédits
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[230px] overflow-y-auto p-0">
                {allLoansList.length > 0 ? (
                    <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                        {allLoansList.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between p-4 hover:bg-amber-50/50 transition-all">
                                <div className="grid gap-0.5">
                                    <span className="font-black text-xs text-foreground uppercase tracking-tight">
                                        {getDebtorName(loan)}
                                    </span>
                                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-bold">
                                        <span>{loan.tableName}</span>
                                        <span>•</span>
                                        <span>{new Date(loan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-xs text-amber-600">{formatCurrency(loan.finalPriceMAD)}</span>
                                    <span className="text-[8px] uppercase font-black opacity-40">En attente</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-40 py-8">
                        <CheckCircle className="h-10 w-10" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aucun impayé</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
      
      <div className="space-y-6">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-tighter">Mes parties actives</h2>
            <div className="h-px flex-1 bg-border"></div>
        </div>
        {myCurrentSessionGames.length > 0 ? (
            <GamesTable games={myCurrentSessionGames} isAdmin={false} updateGame={updateGame} currentUserId={user?.id} />
        ) : (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground opacity-60 space-y-2">
                <CheckCircle className="h-8 w-8" />
                <p className="text-[10px] font-black uppercase tracking-widest">Aucune partie active</p>
            </div>
        )}
      </div>

      <div className="space-y-6 pt-4">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-tighter">Journal du club</h2>
            <div className="h-px flex-1 bg-border"></div>
        </div>
        {allDayGames.length > 0 ? (
            <GamesTable games={allDayGames} isAdmin={false} />
        ) : (
            <div className="flex flex-col items-center justify-center py-12 border rounded-xl bg-muted/10 text-muted-foreground opacity-50">
                <p className="text-[10px] font-black uppercase tracking-widest">En attente d'activité...</p>
            </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
