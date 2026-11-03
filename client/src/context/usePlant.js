// client/src/context/usePlant.js
import { useContext } from 'react';
import { PlantContext } from './PlantContext';

export const usePlant = () => {
  const context = useContext(PlantContext);
  if (context === undefined) {
    throw new Error('usePlant must be used within a PlantProvider');
  }
  return context;
};