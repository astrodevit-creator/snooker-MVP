import { useState, useEffect, useMemo } from 'react';
import { useGames } from './useGames';
import { Game, GameStatus } from '../types';

export interface AIAuditorAlert {
  id: string;
  game: Game;
  elapsedMinutes: number;
  thresholdMinutes: number;
  excessMinutes: number;
  tableType: 'mini' | 'royal';
  recommendation: string;
}

// Simple browser Audio Synthesizer to make the applet feel fully responsive and audit-focused
export const playAuditorChime = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Play a premium dual-tone chime (high quality, alert-style but polite)
    const now = ctx.currentTime;
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second tone slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.1); // A5
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.55);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.75);
  } catch (err) {
    console.warn("Could not play synthesized audio alert:", err);
  }
};

export const useAIAuditor = () => {
  const { games } = useGames();
  const [timeTick, setTimeTick] = useState<number>(Date.now());

  // Update elapsed calculation every 10 seconds for real-time accuracy
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const alerts = useMemo<AIAuditorAlert[]>(() => {
    return games
      .filter(game => game.status === GameStatus.RUNNING)
      .map(game => {
        const startTime = new Date(game.startTime).getTime();
        const elapsedMinutes = Math.max(0, (timeTick - startTime) / (1000 * 60));
        
        const isMini = game.tableName.toLowerCase().includes('mini');
        const isRoyal = game.tableName.toLowerCase().includes('royal') || 
                        game.tableName.toLowerCase().includes('magnum') || 
                        game.tableName.toLowerCase().includes('stroon');
        
        const thresholdMinutes = isMini ? 25 : (isRoyal ? 45 : 30); // Fallback to 30 mins for safety
        const excessMinutes = Math.max(0, elapsedMinutes - thresholdMinutes);
        const tableType = isMini ? 'mini' : 'royal' as const;

        let recommendation = '';
        if (isMini) {
          recommendation = `La table Mini a dépassé le seuil de 25 minutes de jeu. Recommandation : Veuillez vérifier s'ils finissent leur cadre ou s'ils souhaitent prolonger.`;
        } else {
          recommendation = `La table Royal a dépassé le seuil de 45 minutes de jeu. Recommandation : Veuillez approcher les joueurs pour faire le point de fin de partie.`;
        }

        return {
          id: game.id,
          game,
          elapsedMinutes,
          thresholdMinutes,
          excessMinutes,
          tableType,
          recommendation,
        };
      })
      .filter(alert => alert.elapsedMinutes > alert.thresholdMinutes);
  }, [games, timeTick]);

  // Audio alert trigger when count increases
  const alertCount = alerts.length;
  useEffect(() => {
    if (alertCount > 0) {
      // Check if we already notified for these alerts in this session
      const stored = localStorage.getItem('ai_audited_notified') || '[]';
      const notifiedIds: string[] = JSON.parse(stored);
      
      const newAlerts = alerts.filter(a => !notifiedIds.includes(a.id));
      if (newAlerts.length > 0) {
        // Play the alert chime!
        playAuditorChime();
        // Update stored list of notified game IDs
        const updatedIds = [...notifiedIds, ...newAlerts.map(a => a.id)];
        localStorage.setItem('ai_audited_notified', JSON.stringify(updatedIds));
      }
    }
  }, [alerts, alertCount]);

  return {
    alerts,
    hasAlerts: alertCount > 0,
    alertCount,
    triggerSound: playAuditorChime,
  };
};
