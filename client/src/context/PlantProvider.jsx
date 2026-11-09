import { useState } from 'react';
import { PlantContext } from './PlantContext';

export const PlantProvider = ({ children }) => {
  const [selectedPlant, setSelectedPlant] = useState('All Plants');
  const plants = ['All Plants', 'Company-wide', 'Laguna', 'Cavite'];

  return (
    <PlantContext.Provider value={{ selectedPlant, setSelectedPlant, plants }}>
      {children}
    </PlantContext.Provider>
  );
};