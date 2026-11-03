import { useState } from 'react';
import { PlantContext } from './PlantContext';
import { useAuth } from './AuthContext';

// Strictly exports the React component
export const PlantProvider = ({ children }) => {
  const { user } = useAuth();
  
  const [selectedPlant, setSelectedPlant] = useState(user?.plant || 'All Plants');
  const plants = ['All Plants', 'Laguna', 'Cavite'];

  return (
    <PlantContext.Provider value={{ selectedPlant, setSelectedPlant, plants }}>
      {children}
    </PlantContext.Provider>
  );
};