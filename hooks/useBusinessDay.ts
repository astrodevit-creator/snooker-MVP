import { useContext } from 'react';
import { BusinessDayContext } from '../contexts/BusinessDayContext';

export const useBusinessDay = () => {
  const context = useContext(BusinessDayContext);
  if (context === undefined) {
    throw new Error('useBusinessDay must be used within a BusinessDayProvider');
  }
  return context;
};
