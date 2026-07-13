
import React, { useState, useEffect, useMemo } from 'react';
import { Game, GameStatus, PaymentStatus } from '../types';
import { formatCurrency, formatDuration, calculateLivePrice, calculateFinalPrice, getMinPrice } from '../lib/utils';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { MoreVerticalIcon, ClockIcon, DollarSignIcon, AlertTriangle, CheckCircle, TrophyIcon, LockIcon } from './icons';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { TABLES, DEFAULT_HOURLY_RATE } from '../constants';
import { useAuth } from '../hooks/useAuth';

interface GameRowProps {
  game: Game;
  isAdmin: boolean;
  updateGame?: (gameId: string, updates: Partial<Game>) => void;
  deleteGame?: (gameId:string) => void;
  currentUserId?: string;
}

const GameRow: React.FC<GameRowProps> = ({ game, isAdmin, updateGame, deleteGame, currentUserId }) => {
    const { user: currentUserDetails } = useAuth();
    const gameRate = game.hourlyRate || DEFAULT_HOURLY_RATE;

    const allowedTablesList = useMemo(() => {
        if (!currentUserDetails) return TABLES;
        if (currentUserDetails.role === 'admin') return TABLES;
        if (currentUserDetails.allowedTables) {
            const allowedNames = currentUserDetails.allowedTables.split(',').map(s => s.trim().toLowerCase());
            return TABLES.filter(t => allowedNames.includes(t.name.trim().toLowerCase()));
        }
        return TABLES;
    }, [currentUserDetails]);

    const calculateCurrentDuration = () => {
        if (game.status === GameStatus.RUNNING) {
            const start = new Date(game.startTime).getTime();
            const now = Date.now();
            return Math.max(0, Math.floor((now - start) / 1000));
        }
        return 0;
    };

    const [liveDuration, setLiveDuration] = useState<number>(calculateCurrentDuration);
    
    const [livePrice, setLivePrice] = useState<number>(() => {
         if (game.status === GameStatus.RUNNING) {
             return calculateLivePrice(game.startTime, gameRate, game.tableName);
         }
         return 0;
    });

    const [isEditing, setIsEditing] = useState(false);
    
    const [editableGame, setEditableGame] = useState({
      tableName: game.tableName ?? '',
      hourlyRate: gameRate,
      player1: game.player1,
      player2: game.player2 ?? '',
      winner: game.winner ?? null,
      discountMAD: game.discountMAD ?? 0,
      status: game.status,
      paymentStatus: game.paymentStatus === PaymentStatus.PENDING ? PaymentStatus.PAID : game.paymentStatus,
      finalPriceMAD: game.finalPriceMAD ?? 0,
      notes: game.notes ?? '1',
    });
    
    useEffect(() => {
        if (game.status === GameStatus.RUNNING && !isEditing) {
            const updateStats = () => {
                setLiveDuration(calculateCurrentDuration());
                setLivePrice(calculateLivePrice(game.startTime, gameRate, game.tableName));
            };
            
            updateStats();
            const interval = setInterval(updateStats, 1000);
            return () => clearInterval(interval);
        }
    }, [game.status, game.startTime, isEditing, gameRate, game.tableName]);

    const resetEditableGame = () => {
        setEditableGame({
            tableName: game.tableName ?? '',
            hourlyRate: gameRate,
            player1: game.player1,
            player2: game.player2 ?? '',
            winner: game.winner ?? null,
            discountMAD: game.discountMAD ?? 0,
            status: game.status,
            paymentStatus: game.paymentStatus === PaymentStatus.PENDING ? PaymentStatus.PAID : game.paymentStatus,
            finalPriceMAD: game.finalPriceMAD ?? 0,
            notes: game.notes ?? '1',
        });
    };

    const startEditing = () => {
        resetEditableGame();
        setIsEditing(true);
    };

    const handleTableChange = (tableId: string) => {
        const config = TABLES.find(t => t.id === tableId);
        if (config) {
             setEditableGame({
                 ...editableGame,
                 tableName: config.name,
                 hourlyRate: config.rate
             });
        }
    };
    
    const handleStatusChange = (newStatus: GameStatus) => {
        let newFinalPrice = editableGame.finalPriceMAD;
        if (game.status === GameStatus.RUNNING && newStatus === GameStatus.FINISHED) {
            const endTime = new Date().toISOString();
            const discount = isAdmin ? Number(editableGame.discountMAD) : game.discountMAD;
            const { finalPrice } = calculateFinalPrice(game.startTime, endTime, discount, editableGame.hourlyRate, editableGame.tableName, editableGame.notes);
            newFinalPrice = Number(finalPrice.toFixed(2));
        }
        
        setEditableGame({
            ...editableGame,
            status: newStatus,
            finalPriceMAD: newFinalPrice,
        });
    }

    const handleSaveChanges = () => {
      if (!updateGame || !currentUserId) return;

      const updates: Partial<Game> = {
          tableName: editableGame.tableName,
          hourlyRate: editableGame.hourlyRate,
          player1: editableGame.player1,
          player2: editableGame.player2 || null,
          winner: editableGame.winner,
          paymentStatus: editableGame.paymentStatus,
          modifiedBy: currentUserId,
          notes: editableGame.notes,
      };

      if (game.status === GameStatus.RUNNING && editableGame.status === GameStatus.FINISHED) {
          const endTime = new Date().toISOString();
          const discount = isAdmin ? Number(editableGame.discountMAD) : game.discountMAD;
          const { durationSeconds, price, finalPrice } = calculateFinalPrice(game.startTime, endTime, discount, editableGame.hourlyRate, editableGame.tableName, editableGame.notes);
          
          updates.status = GameStatus.FINISHED;
          updates.endTime = endTime;
          updates.durationSeconds = durationSeconds;
          updates.priceMAD = price;
          updates.finalPriceMAD = Math.max(getMinPrice(editableGame.tableName, editableGame.notes), Number(editableGame.finalPriceMAD));
          updates.discountMAD = discount;
      } else if (game.status === GameStatus.FINISHED) {
        updates.finalPriceMAD = Number(editableGame.finalPriceMAD);
        if (isAdmin) {
          updates.discountMAD = Number(editableGame.discountMAD);
        }
      }
      
      updateGame(game.id, updates);
      setIsEditing(false);
    };
    
    const handleCancelEdit = () => {
      setIsEditing(false);
      resetEditableGame();
    };

    const priceToDisplay = game.status === GameStatus.RUNNING ? livePrice : (game.finalPriceMAD ?? 0);
    const durationToDisplay = game.status === GameStatus.RUNNING ? liveDuration : (game.durationSeconds ?? 0);

    const isMini = game.tableName.toLowerCase().includes('mini');
    const isRoyal = game.tableName.toLowerCase().includes('royal') || 
                    game.tableName.toLowerCase().includes('magnum') || 
                    game.tableName.toLowerCase().includes('stroon');

    const isRunning = game.status === GameStatus.RUNNING;
    const elapsedMinutes = isRunning ? (liveDuration / 60) : 0;
    const isLimitExceeded = isRunning && (
        (isMini && elapsedMinutes > 25) || 
        (isRoyal && elapsedMinutes > 45)
    );

    const getDebtorName = () => {
        if (game.paymentStatus !== PaymentStatus.LOAN) return null;
        if (!game.player2) return game.player1;
        // Le perdant est celui qui n'est pas le gagnant
        if (game.winner === game.player1) return game.player2;
        if (game.winner === game.player2) return game.player1;
        return game.player1;
    };

    const statusColors = {
        [PaymentStatus.PAID]: 'border-green-500 bg-green-500/[0.03]',
        [PaymentStatus.PENDING]: 'border-blue-500 bg-blue-500/[0.03]',
        [PaymentStatus.LOAN]: 'border-amber-500 bg-amber-500/[0.03]',
    };

    const paymentStatusBadge = {
        [PaymentStatus.PAID]: 'bg-green-600 text-white',
        [PaymentStatus.PENDING]: 'bg-blue-600 text-white',
        [PaymentStatus.LOAN]: 'bg-amber-500 text-white',
    };

    const isLocked = !isAdmin && game.paymentStatus === PaymentStatus.PAID;
    const showActions = (isAdmin || (game.createdBy === currentUserId)) && !isLocked;

    const currentTableConfig = TABLES.find(t => t.name === editableGame.tableName);
    const currentTableId = currentTableConfig ? currentTableConfig.id : '';

    if (isEditing) {
        return (
            <tr className="border-b">
                <td colSpan={8} className="p-0 bg-background">
                    <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h4 className="text-xl font-black uppercase tracking-tighter">Modifier la partie</h4>
                            <Badge variant="outline" className="text-[10px] font-black">{game.tableName}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Table assignée</label>
                                        <Select value={currentTableId} onChange={(e) => handleTableChange(e.target.value)} className="w-full h-12 text-base font-bold">
                                            {allowedTablesList.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Nombre de parties</label>
                                        <Select value={editableGame.notes ?? '1'} onChange={(e) => setEditableGame({...editableGame, notes: e.target.value})} className="w-full h-12 text-base font-bold">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => (
                                                <option key={n} value={String(n)}>{n} {n === 1 ? 'partie' : 'parties'}</option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Joueur 1</label>
                                        <Input type="text" value={editableGame.player1} onChange={(e) => setEditableGame({...editableGame, player1: e.target.value})} className="h-12 font-bold" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Joueur 2</label>
                                        <Input type="text" value={editableGame.player2} onChange={(e) => setEditableGame({...editableGame, player2: e.target.value})} className="h-12 font-bold" />
                                    </div>
                                </div>

                                {editableGame.player2 && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Qui a gagné ? (Le gagnant ne paie rien)</label>
                                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-2xl">
                                            <button 
                                                onClick={() => setEditableGame({...editableGame, winner: editableGame.player1})}
                                                className={`py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${editableGame.winner === editableGame.player1 ? 'bg-background shadow-lg text-green-600 scale-[1.02]' : 'text-muted-foreground opacity-50'}`}
                                            >
                                                {editableGame.winner === editableGame.player1 && <TrophyIcon className="h-3 w-3" />}
                                                {editableGame.player1 || 'P1'}
                                            </button>
                                            <button 
                                                onClick={() => setEditableGame({...editableGame, winner: editableGame.player2})}
                                                className={`py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${editableGame.winner === editableGame.player2 ? 'bg-background shadow-lg text-green-600 scale-[1.02]' : 'text-muted-foreground opacity-50'}`}
                                            >
                                                {editableGame.winner === editableGame.player2 && <TrophyIcon className="h-3 w-3" />}
                                                {editableGame.player2 || 'P2'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase opacity-60 ml-1">Statut de la session</label>
                                     <div className="flex p-1 bg-muted rounded-xl gap-1">
                                        <button 
                                            onClick={() => handleStatusChange(GameStatus.RUNNING)}
                                            disabled={game.status === GameStatus.FINISHED}
                                            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${editableGame.status === GameStatus.RUNNING ? 'bg-background shadow text-primary' : 'text-muted-foreground'}`}
                                        >
                                            En cours
                                        </button>
                                        <button 
                                            onClick={() => handleStatusChange(GameStatus.FINISHED)}
                                            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${editableGame.status === GameStatus.FINISHED ? 'bg-background shadow text-primary' : 'text-muted-foreground'}`}
                                        >
                                            Terminée
                                        </button>
                                     </div>
                                </div>

                                {editableGame.status === GameStatus.FINISHED && (
                                    <>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Montant à facturer (MAD)</label>
                                        <Input 
                                            type="number" 
                                            value={editableGame.finalPriceMAD} 
                                            onChange={(e) => setEditableGame({ ...editableGame, finalPriceMAD: Number(e.target.value) })} 
                                            className="h-14 text-2xl font-black text-primary border-2" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase opacity-60 ml-1">Mode de paiement</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => setEditableGame({ ...editableGame, paymentStatus: PaymentStatus.PAID })}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${editableGame.paymentStatus === PaymentStatus.PAID ? 'bg-green-600 border-green-600 text-white shadow-xl' : 'bg-muted/50 border-transparent text-muted-foreground'}`}
                                            >
                                                <CheckCircle className="h-6 w-6" />
                                                <span className="text-xs font-black uppercase">Payé Espèces</span>
                                            </button>
                                            <button 
                                                onClick={() => setEditableGame({ ...editableGame, paymentStatus: PaymentStatus.LOAN })}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${editableGame.paymentStatus === PaymentStatus.LOAN ? 'bg-amber-500 border-amber-500 text-white shadow-xl' : 'bg-muted/50 border-transparent text-muted-foreground'}`}
                                            >
                                                <AlertTriangle className="h-6 w-6" />
                                                <span className="text-xs font-black uppercase">Marquer Crédit</span>
                                            </button>
                                        </div>
                                    </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6 border-t">
                            <Button className="flex-1 h-14 text-base font-black uppercase tracking-widest shadow-xl" onClick={handleSaveChanges}>Appliquer</Button>
                            <Button variant="outline" className="h-14 px-8 font-black uppercase text-xs tracking-widest" onClick={handleCancelEdit}>Annuler</Button>
                        </div>
                    </div>
                </td>
            </tr>
        );
    }
    
    return (
        <>
        {/* Desktop View Row */}
        <tr className={`border-b transition-colors hover:bg-muted/50 hidden md:table-row ${isLimitExceeded ? 'bg-red-500/5 hover:bg-red-500/10' : ''}`}>
            <td className="p-4 align-middle font-bold text-muted-foreground/60">{game.tableName}</td>
            <td className="p-4 align-middle">
                <div className="font-black text-base uppercase">{game.player1}{game.player2 ? ` vs ${game.player2}` : ''}</div>
                {game.winner && <div className="text-[10px] font-black text-green-600 uppercase">Gagnant: {game.winner}</div>}
            </td>
            <td className="p-4 align-middle">
                <Badge variant="outline" className="font-black text-[11px] px-2.5 py-0.5 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300">
                    {game.notes || '1'} {Number(game.notes || '1') > 1 ? 'Parties' : 'Partie'}
                </Badge>
            </td>
            <td className="p-4 align-middle text-[10px] font-bold uppercase text-muted-foreground">
                {new Date(game.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                {game.endTime && ` — ${new Date(game.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
            </td>
            <td className="p-4 align-middle font-mono font-bold">
                <span className={isLimitExceeded ? "text-red-600 font-black animate-pulse" : ""}>
                    {formatDuration(durationToDisplay)}
                </span>
            </td>
            <td className="p-4 align-middle">
                <div className={`font-black text-lg ${game.paymentStatus === PaymentStatus.LOAN ? 'text-amber-600' : 'text-foreground'}`}>
                    {formatCurrency(priceToDisplay)}
                </div>
            </td>
            <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                    <Badge variant={game.status === GameStatus.RUNNING ? "default" : "secondary"} className={`uppercase font-black text-[9px] ${isLimitExceeded ? 'bg-red-600 hover:bg-red-600 text-white' : ''}`}>
                        {game.status === GameStatus.RUNNING ? 'En cours' : 'Terminée'}
                    </Badge>
                    {isLimitExceeded && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                            Alerte IA
                        </span>
                    )}
                </div>
            </td>
            <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                    <Badge className={`${paymentStatusBadge[game.paymentStatus]} uppercase font-black text-[9px] border-none px-3`}>
                        {game.paymentStatus === PaymentStatus.PENDING ? 'Active' : (game.paymentStatus === PaymentStatus.PAID ? 'Payé' : 'Crédit')}
                    </Badge>
                    {game.paymentStatus === PaymentStatus.LOAN && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                </div>
            </td>
            <td className="p-4 align-middle text-right">
                {showActions ? (
                    <Button variant="ghost" size="icon" onClick={startEditing} className="rounded-full hover:bg-primary/10">
                        <MoreVerticalIcon className="h-4 w-4" />
                    </Button>
                ) : isLocked && (
                    <div className="flex justify-end pr-2 text-muted-foreground/40" title="Verrouillé : Les enregistrements payés ne peuvent plus être modifiés.">
                        <LockIcon className="h-4 w-4" />
                    </div>
                )}
            </td>
        </tr>

        {/* Mobile View Card */}
        <tr className="md:hidden border-none bg-transparent">
            <td colSpan={9} className="p-3 border-none bg-transparent">
                <div className={`relative overflow-hidden rounded-3xl border-l-[6px] shadow-xl transition-all ${isLimitExceeded ? 'border-red-600 bg-red-500/[0.03] dark:bg-red-950/5' : statusColors[game.paymentStatus]} bg-card dark:bg-zinc-900 border-t border-r border-b border-border`}>
                    
                    <div className="absolute -right-4 -top-4 opacity-[0.05] dark:opacity-[0.08] pointer-events-none">
                        {game.paymentStatus === PaymentStatus.PAID && <DollarSignIcon className="h-32 w-32 rotate-12" />}
                        {game.paymentStatus === PaymentStatus.LOAN && <AlertTriangle className="h-32 w-32 -rotate-12" />}
                    </div>

                    <div className="p-6 space-y-5 relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isLimitExceeded ? 'bg-red-600 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900'}`}>
                                    {game.tableName}
                                </span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <ClockIcon className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-black uppercase">
                                        {new Date(game.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {game.endTime && ` • ${new Date(game.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </span>
                                </div>
                            </div>
                            {showActions ? (
                                <Button size="sm" onClick={startEditing} className="h-10 rounded-2xl text-[10px] font-black uppercase px-5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 shadow-sm">
                                    Modifier
                                </Button>
                            ) : isLocked && (
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase text-muted-foreground/40 bg-muted px-3 py-2 rounded-xl border">
                                    <LockIcon className="h-3 w-3" />
                                    <span>Verrouillé</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-xl font-black tracking-tighter leading-none uppercase truncate text-zinc-900 dark:text-zinc-50">
                                {game.player1}
                                {game.player2 && <span className="text-muted-foreground/30 mx-2 text-sm">vs</span>}
                                {game.player2}
                            </h3>
                            
                            <div className="flex flex-wrap gap-2 items-center pt-1">
                                <Badge variant="outline" className="font-black text-[9px] px-2 py-0.5 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-muted-foreground uppercase">
                                    {game.notes || '1'} {Number(game.notes || '1') > 1 ? 'Parties' : 'Partie'}
                                </Badge>
                                {game.paymentStatus === PaymentStatus.LOAN && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm border border-amber-600/20">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span className="text-[8px] font-black uppercase tracking-widest italic">
                                            Dû par : {getDebtorName()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-border/50">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Durée</p>
                                <div className={`font-mono text-base font-black ${isLimitExceeded ? 'text-red-600 animate-pulse' : (game.status === GameStatus.RUNNING ? 'text-blue-600' : 'text-zinc-500')}`}>
                                    {formatDuration(durationToDisplay)}
                                </div>
                            </div>
                            <div className="text-right space-y-0.5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total à payer</p>
                                <div className={`text-2xl font-black ${game.paymentStatus === PaymentStatus.LOAN ? 'text-amber-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                    {formatCurrency(priceToDisplay)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Badge className={`${paymentStatusBadge[game.paymentStatus]} border-none uppercase font-black text-[10px] tracking-widest px-4 py-1.5 rounded-xl shadow-sm`}>
                                {game.paymentStatus === PaymentStatus.PENDING ? 'Session active' : (game.paymentStatus === PaymentStatus.PAID ? 'Payé' : 'Crédit')}
                            </Badge>
                            {game.status === GameStatus.RUNNING && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isLimitExceeded ? 'bg-red-600/10 text-red-600 border-red-600/20 animate-pulse' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                                    <div className={`h-2 w-2 rounded-full ${isLimitExceeded ? 'bg-red-600' : 'bg-blue-600'} animate-pulse`}></div>
                                    <span className="text-[9px] font-black uppercase">
                                        {isLimitExceeded ? 'Alerte IA' : 'En jeu'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
        </>
    );
};

export default GameRow;
