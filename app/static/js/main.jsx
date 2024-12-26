// app/static/js/main.jsx
import '../css/main.css'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { NavigationProvider, useNavigation } from '@contexts/NavigationContext';
import { PracticeItemsList } from '@components/PracticeItemsList';
import { PracticePage } from '@components/PracticePage';
import NavMenu from '@components/NavMenu';
import RoutinesPage from '@components/RoutinesPage';

const PageContent = () => {
  const { activePage } = useNavigation();
  
  switch (activePage) {
    case 'Practice':
      return <PracticePage />;
    case 'Routines':
      return <RoutinesPage />;
    case 'Items':
      return <PracticeItemsList />;
    default:
      return <div>Page not implemented yet</div>;
  }
};

const App = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-orange-500 mb-8">Guitar Practice Assistant</h1>
      <NavMenu />
      <PageContent />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NavigationProvider>
      <App />
    </NavigationProvider>
  </React.StrictMode>
);