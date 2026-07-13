
import React from 'react';
import { Game, PaymentStatus } from '../types';
import { formatCurrency, formatDuration } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { PrinterIcon, CheckCircle, ArrowLeftIcon } from './icons';
import { useAuth } from '../hooks/useAuth';

interface DailyClosureReportProps {
  date: string;
  endDate?: string;
  games: Game[];
  onBack: () => void;
  summaryText?: string;
  isArchiveView?: boolean;
}

const DailyClosureReport: React.FC<DailyClosureReportProps> = ({ date, endDate, games, onBack, summaryText, isArchiveView = false }) => {
  const { user } = useAuth();
  const stats = games.reduce(
    (acc, game) => {
      const pCount = Number(game.notes || '1');
      if (game.paymentStatus === PaymentStatus.PAID) {
        acc.paid += game.finalPriceMAD || 0;
        acc.paidCount += pCount;
      } else if (game.paymentStatus === PaymentStatus.LOAN) {
        acc.loan += game.finalPriceMAD || 0;
        acc.loanCount += pCount;
      }
      acc.totalDiscount += game.discountMAD || 0;
      return acc;
    },
    { paid: 0, loan: 0, paidCount: 0, loanCount: 0, totalDiscount: 0 }
  );

  const handlePrint = () => {
    window.print();
  };

  const getDebtor = (game: Game) => {
    if (game.paymentStatus !== PaymentStatus.LOAN) return '-';
    if (!game.player2) return game.player1;
    if (game.winner === game.player1) return game.player2;
    if (game.winner === game.player2) return game.player1;
    return game.player1;
  };

  const isRange = endDate && endDate !== date;

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-8 px-4 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center no-print">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Retour
        </Button>
        <Button onClick={handlePrint} className="gap-2 bg-primary">
          <PrinterIcon className="h-4 w-4" />
          Imprimer le Rapport
        </Button>
      </div>

      <Card className="border-2 shadow-2xl print:shadow-none print:border-black bg-white dark:bg-zinc-950">
        <CardHeader className="text-center border-b border-dashed pb-8">
          <CardTitle className="text-3xl font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
            {isArchiveView ? "Rapport d'Activité" : "Clôture de Session"}
          </CardTitle>
          <div className="text-muted-foreground mt-2 flex flex-col items-center gap-1">
             <span className="font-bold text-lg text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">
                {isRange ? (
                  <>Du {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {new Date(endDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                ) : (
                  new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                )}
             </span>
             <span className="text-[10px] uppercase tracking-tighter">Généré le : {new Date().toLocaleString('fr-FR')}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-8 space-y-8">
          {summaryText && (
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Analyse IA du Manager</h4>
                <p className="text-sm italic leading-relaxed text-zinc-700 dark:text-zinc-300">"{summaryText}"</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border-2 border-green-600/20 bg-green-50/50 dark:bg-green-950/10 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Total Espèces</span>
              <span className="text-3xl font-black text-green-700 dark:text-green-400">{formatCurrency(stats.paid)}</span>
              <span className="text-[10px] text-green-600/70 mt-1">{stats.paidCount} {stats.paidCount > 1 ? 'Parties' : 'Partie'}</span>
            </div>
            <div className="p-4 rounded-xl border-2 border-amber-600/20 bg-amber-50/50 dark:bg-amber-950/10 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Total Crédits</span>
              <span className="text-3xl font-black text-amber-700 dark:text-amber-400">{formatCurrency(stats.loan)}</span>
              <span className="text-[10px] text-amber-600/70 mt-1">{stats.loanCount} {stats.loanCount > 1 ? 'Parties' : 'Partie'}</span>
            </div>
            <div className="p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Remises Totales</span>
              <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(stats.totalDiscount)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-xs uppercase tracking-widest border-l-4 border-primary pl-3 text-zinc-900 dark:text-zinc-100">Détail des Opérations</h3>
            <div className="border border-dashed rounded-lg overflow-x-auto border-zinc-300 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-[10px] uppercase font-black">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Table</th>
                    <th className="p-3 text-left">Joueurs</th>
                    <th className="p-3 text-center">Parties</th>
                    <th className="p-3 text-right">Statut</th>
                    <th className="p-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed">
                  {games.map((game) => (
                    <tr key={game.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="p-3 whitespace-nowrap text-[10px] font-black text-zinc-400">
                        {new Date(game.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="p-3 font-bold text-zinc-800 dark:text-zinc-200">{game.tableName}</td>
                      <td className="p-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {game.player1}{game.player2 ? ` vs ${game.player2}` : ''}
                      </td>
                      <td className="p-3 text-center text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {game.notes || '1'}
                      </td>
                      <td className="p-3 text-right text-xs">
                        {game.paymentStatus === PaymentStatus.LOAN ? (
                            <span className="text-amber-600 font-bold uppercase text-[9px]">Crédit : {getDebtor(game)}</span>
                        ) : (
                            <span className="text-green-600 font-bold uppercase text-[9px]">Payé</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-black text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(game.finalPriceMAD)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-6 border-t border-dashed border-zinc-300 dark:border-zinc-800 flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full md:w-72 text-2xl font-black pt-4 border-t-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100">
              <span>Grand Total :</span>
              <span>{formatCurrency(stats.paid + stats.loan)}</span>
            </div>
          </div>
        </CardContent>
        
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 text-center text-[10px] font-black uppercase text-zinc-400 tracking-widest border-t border-dashed border-zinc-300 dark:border-zinc-800">
            Rapport validé par {user?.email}
        </div>
      </Card>
    </div>
  );
};

export default DailyClosureReport;
