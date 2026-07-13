
import React, { useState } from 'react';
import { Game } from '../types';
import { Button } from './ui/Button';
import { generateDailySummaryText } from '../services/geminiService';
import { LoaderCircle, PrinterIcon } from './icons';
import DailyClosureReport from './DailyClosureReport';

interface PrintResumeButtonProps {
  games: Game[];
  startDate: string;
  endDate: string;
}

const PrintResumeButton: React.FC<PrintResumeButtonProps> = ({ games, startDate, endDate }) => {
  const [summaryText, setSummaryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const handlePrepare = async () => {
    setIsGenerating(true);
    try {
      const summary = await generateDailySummaryText(games);
      setSummaryText(summary);
      setShowReport(true);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Erreur lors de la génération du résumé. Veuillez réessayer.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (showReport) {
      return (
          <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
              <DailyClosureReport 
                date={startDate} 
                endDate={endDate}
                games={games} 
                onBack={() => setShowReport(false)} 
                summaryText={summaryText}
                isArchiveView={true}
              />
          </div>
      );
  }

  return (
    <Button 
        onClick={handlePrepare} 
        disabled={isGenerating || games.length === 0}
        variant="outline"
        className="gap-2 h-10 px-4 font-black uppercase text-[10px]"
    >
      {isGenerating ? (
        <>
          <LoaderCircle className="h-3 w-3 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <PrinterIcon className="h-3 w-3" />
          Rapport Périodique
        </>
      )}
    </Button>
  );
};

export default PrintResumeButton;
