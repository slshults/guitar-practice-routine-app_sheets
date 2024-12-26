// app/static/js/hooks/useRoutineEditor.js
import { useState, useEffect, useMemo } from 'react';
import { usePracticeItems } from './usePracticeItems';

export const useRoutineEditor = (routineName = null) => {
  const { items: allItems } = usePracticeItems();
  const [selectedItems, setSelectedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load existing routine if editing
  useEffect(() => {
    if (routineName) {
      fetchRoutine();
    } else {
      setSelectedItems([]);
      setLoading(false);
    }
  }, [routineName]);

  const fetchRoutine = async () => {
    try {
      const response = await fetch(`/api/routines/${routineName}`);
      if (!response.ok) throw new Error('Failed to fetch routine');
      const data = await response.json();
      setSelectedItems(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter available items based on search query and exclude selected items
  const availableItems = useMemo(() => {
    const selectedItemIds = new Set(selectedItems.map(item => item['Item ID']));
    return allItems.filter(item => 
      !selectedItemIds.has(item.ID) && 
      item.Title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allItems, selectedItems, searchQuery]);

  const addToRoutine = async (routineName, itemId, notes = "") => {
    try {
      const response = await fetch(`/api/routines/${routineName}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, notes })
      });
      if (!response.ok) throw new Error('Failed to add item to routine');
      const data = await response.json();
      setSelectedItems(current => [...current, data]);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Add error:', err);
      return false;
    }
  };

  const removeFromRoutine = async (routineName, itemId) => {
    try {
      const response = await fetch(`/api/routines/${routineName}/items/${itemId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove item from routine');
      setSelectedItems(current => current.filter(item => item.ID !== itemId));
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Remove error:', err);
      return false;
    }
  };

  const updateRoutineOrder = async (routineName, items) => {
    try {
      const response = await fetch(`/api/routines/${routineName}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      });
      if (!response.ok) throw new Error('Failed to update routine order');
      const data = await response.json();
      setSelectedItems(data);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Update error:', err);
      return false;
    }
  };

  const createRoutine = async (name) => {
    try {
      const response = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineName: name })
      });
      if (!response.ok) throw new Error('Failed to create routine');
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Create error:', err);
      return false;
    }
  };

  return {
    availableItems,
    selectedItems,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    createRoutine,
    addToRoutine,
    removeFromRoutine,
    updateRoutineOrder
  };
};