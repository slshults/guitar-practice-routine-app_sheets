// app/static/js/contexts/NavigationContext.jsx
import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext(undefined);

export const NavigationProvider = ({ children }) => {
  const [activePage, setActivePage] = useState('Practice');

  return (
    <NavigationContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
