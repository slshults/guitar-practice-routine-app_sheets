// app/static/js/hooks/useRoutineEditor.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePracticeItems } from './usePracticeItems';

export const useRoutineEditor = (routineName = null) => {
  const { items: allItems } = usePracticeItems();
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemDetails, setItemDetails] = useState({});
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

  // Fetch item details when needed
  const fetchItemDetails = useCallback(async (itemId) => {
    try {
      const response = await fetch(`/api/items/${itemId}`);
      if (!response.ok) throw new Error('Failed to fetch item details');
      const data = await response.json();
      setItemDetails(prev => ({
        ...prev,
        [itemId]: data
      }));
      return data;
    } catch (err) {
      console.error('Error fetching item details:', err);
      return null;
    }
  }, []);

  const fetchRoutine = async () => {
    try {
      const response = await fetch(`/api/routines/${routineName}`);
      if (!response.ok) throw new Error('Failed to fetch routine');
      const routineItems = await response.json();

      // Fetch details for each item
      const itemPromises = routineItems.map(async (routineItem) => {
        // routineItem will have values from columns A (ID), B (Item ID), C (order), H (completed)
        const details = itemDetails[routineItem['B']] || 
          await fetchItemDetails(routineItem['B']);
        return {
          ...routineItem,
          'A': routineItem['A'],  // ID
          'B': routineItem['B'],  // Item ID
          'C': routineItem['C'],  // order
          'H': routineItem['H'],  // completed
          'Title': details?.['C'] || 'Loading...',  // Add title for display using Column C
        };
      });

      const itemsWithDetails = await Promise.all(itemPromises);
      setSelectedItems(itemsWithDetails);
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
    const selectedItemIds = new Set(selectedItems.map(item => item['B']));  // Column B is Item ID
    return allItems.filter(item => 
      !selectedItemIds.has(item['A']) &&  // Column A is ID
      item['C']?.toLowerCase().includes(searchQuery.toLowerCase())  // Column C is Title
    );
  }, [allItems, selectedItems, searchQuery]);

  const addToRoutine = async (routineName, itemId) => {
    try {
      const response = await fetch(`/api/routines/${routineName}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });

      if (!response.ok) throw new Error('Failed to add item to routine');
      
      // Refresh the routine to get updated items
      await fetchRoutine();
      return true;
    } catch (err) {
      console.error('Error adding item:', err);
      return false;
    }
  };

  const removeFromRoutine = async (routineName, itemId) => {
    try {
      const response = await fetch(`/api/routines/${routineName}/items/${itemId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to remove item from routine');
      
      // Refresh the routine to get updated items
      await fetchRoutine();
      return true;
    } catch (err) {
      console.error('Error removing item:', err);
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
      
      // Update local state
      setSelectedItems(items);
      return true;
    } catch (err) {
      console.error('Error updating order:', err);
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
    addToRoutine,
    removeFromRoutine,
    updateRoutineOrder,
  };
};