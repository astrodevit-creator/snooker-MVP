
import { useContext } from 'react';
import { GameContext } from '../contexts/GameContext';

export const useGames = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGames must be used within a GameProvider');
  }
  return context;
};
