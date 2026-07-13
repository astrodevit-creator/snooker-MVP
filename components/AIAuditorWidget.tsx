import React, { useState } from 'react';
import { useAIAuditor } from '../hooks/useAIAuditor';
import { SparklesIcon, AlertTriangle, CheckCircle } from './icons';
import { Card, CardContent } from './ui/Card';

export const AIAuditorWidget: React.FC = () => {
  const { alerts, hasAlerts, alertCount } = useAIAuditor();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!hasAlerts) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 shadow-sm">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <SparklesIcon className="h-3.5 w-3.5 text-emerald-500" />
          Auditeur IA Actif : Toutes les tables sont en conformité
        </p>
      </div>
    );
  }

  return (
    <Card className="border-red-500/30 bg-red-500/5 dark:bg-red-500/10 shadow-md border-2 overflow-hidden animate-in fade-in duration-300">
      <CardContent className="p-0">
        <div 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="flex items-center justify-between p-4 bg-red-500/10 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-500 text-white p-2 rounded-xl animate-bounce">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-2">
                Contrôleur IA : Alertes de Jeu Actives
              </h3>
              <p className="text-xs font-bold text-red-700/80 dark:text-red-300/80 mt-0.5">
                {alertCount} table{alertCount > 1 ? 's ont' : ' a'} dépassé {alertCount > 1 ? 'leurs limites' : 'sa limite'} de temps d'usage !
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="text-xs font-black uppercase tracking-widest text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-xl border border-red-500/20"
          >
            {isExpanded ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        {isExpanded && (
          <div className="p-4 border-t border-red-500/20 divide-y divide-red-500/10">
            {alerts.map((alert) => (
              <div key={alert.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-tight text-foreground bg-background px-3 py-1 rounded-lg border border-red-500/20 shadow-sm">
                      {alert.game.tableName}
                    </span>
                    <span className="text-[10px] font-black uppercase bg-red-500/10 text-red-600 px-2.5 py-1 rounded-full border border-red-500/15 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3" />
                      Seuil Dépassé de +{Math.floor(alert.excessMinutes)} min
                    </span>
                  </div>

                  <p className="text-xs font-bold text-muted-foreground">
                    Joueur en cours : <span className="text-foreground uppercase">{alert.game.player1}</span> {alert.game.player2 ? `& ${alert.game.player2}` : ''}
                  </p>

                  <div className="p-3 rounded-xl bg-background border border-red-500/10 text-xs font-semibold leading-relaxed text-red-900 dark:text-red-200">
                    <span className="font-black text-red-600 mr-1">[CONSEIL IA]</span>
                    {alert.recommendation}
                  </div>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 sm:min-w-[150px] bg-red-500/5 p-3 rounded-2xl border border-red-500/10">
                  <div className="text-left sm:text-right w-full">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">Temps de jeu</span>
                    <span className="text-base font-black text-foreground">{Math.floor(alert.elapsedMinutes)} min</span>
                  </div>
                  <div className="text-right w-full border-t border-red-500/10 pt-1.5 mt-1.5 hidden sm:block">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">Seuil d'audit</span>
                    <span className="text-xs font-bold text-muted-foreground">{alert.thresholdMinutes} min max</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
