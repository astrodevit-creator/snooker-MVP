
import { useContext } from 'react';
import { TableContext } from '../contexts/TableContext';

export const useTables = () => {
  const context = useContext(TableContext);
  if (context === undefined) {
    throw new Error('useTables must be used within a TableProvider');
  }
  return context;
};
