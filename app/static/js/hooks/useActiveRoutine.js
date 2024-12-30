import { useState, useEffect } from 'react';

export const useActiveRoutine = () => {
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const fetchActiveRoutine = async () => {
    try {
      const response = await fetch('/api/practice/active-routine');
      if (!response.ok) {
        throw new Error('Failed to fetch active routine');
      }
      const data = await response.json();
      
      if (!data.active_id) {
        setRoutine(null);
        setError(null);
        setLoading(false);
        return;
      }

      setRoutine({
        id: data.active_id,
        name: data.name,
        items: data.items.map(item => ({
          ...item.routineEntry,
          details: item.itemDetails
        }))
      });
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshRoutine = async () => {
    setVersion(v => v + 1);
  };

  // Fetch active routine on mount and when version changes
  useEffect(() => {
    fetchActiveRoutine();
  }, [version]);

  return {
    routine,
    loading,
    error,
    refreshRoutine
  };
}; 