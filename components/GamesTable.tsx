
import React from 'react';
import { Game } from '../types';
import GameRow from './GameRow';

interface GamesTableProps {
  games: Game[];
  isAdmin: boolean;
  updateGame?: (gameId: string, updates: Partial<Game>) => void;
  deleteGame?: (gameId: string) => void;
  currentUserId?: string;
}

const GamesTable: React.FC<GamesTableProps> = ({ games, isAdmin, updateGame, deleteGame, currentUserId }) => {
  const showActionsColumn = isAdmin || currentUserId;
  return (
    <div className="md:border border-border md:rounded-lg overflow-hidden">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm border-collapse">
          <thead className="[&_tr]:border-b hidden md:table-header-group">
            <tr className="border-b transition-colors hover:bg-muted/50 bg-muted/30">
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground w-[120px]">Table</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Players</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Parties</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Time Log</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Duration</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Amount</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Status</th>
              <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Payment</th>
              {showActionsColumn && <th className="h-12 px-4 text-right align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0 space-y-4 md:space-y-0">
            {games.length > 0 ? (
              games.map(game => (
                <GameRow 
                    key={game.id} 
                    game={game} 
                    isAdmin={isAdmin} 
                    updateGame={updateGame}
                    deleteGame={deleteGame}
                    currentUserId={currentUserId}
                />
              ))
            ) : (
              <tr>
                <td colSpan={9} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No records found for this view</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GamesTable;
