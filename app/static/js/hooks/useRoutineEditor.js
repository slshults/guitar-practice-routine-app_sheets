// app/static/js/hooks/useRoutineEditor.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePracticeItems } from './usePracticeItems';

export const useRoutineEditor = (routineId = null) => {
  const { items: allItems } = usePracticeItems();
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemDetails, setItemDetails] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load existing routine if editing
  useEffect(() => {
    if (routineId) {
      fetchRoutine();
    } else {
      setSelectedItems([]);
      setLoading(false);
    }
  }, [routineId]);

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
      const response = await fetch(`/api/routines/${routineId}`);
      if (!response.ok) throw new Error('Failed to fetch routine');
      const routineItems = await response.json();

      // Sort routine items by order (column C)
      routineItems.sort((a, b) => parseInt(a['C']) - parseInt(b['C']));
      console.log('Sorted routine items by order:', routineItems);

      // Fetch details for each item
      const itemPromises = routineItems.map(async (routineEntry) => {
        // Get or fetch item details using the Item ID from routine's column B
        let details = itemDetails[routineEntry['B']];
        if (!details) {
          details = await fetchItemDetails(routineEntry['B']);
        }
        
        // Return an object that keeps routine data and item data separate
        return {
          routineEntry: {
            'A': routineEntry['A'],           // Routine entry ID
            'B': routineEntry['B'],           // Item ID (reference)
            'C': routineEntry['C'],           // Order in routine
            'D': routineEntry['D'] || 'FALSE' // Completed status
          },
          itemDetails: details || {}          // All columns from Items sheet
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
    console.log('=== DEBUG START ===');
    console.log('allItems from usePracticeItems:', allItems);
    console.log('selectedItems from routine:', selectedItems);
    // Get Item IDs from routine entries (column B)
    const selectedItemIds = new Set(selectedItems.map(item => item.routineEntry['B']));
    console.log('selectedItemIds:', Array.from(selectedItemIds));
    const filtered = allItems.filter(item => {
      const isSelected = selectedItemIds.has(item['B']);  // Column B is Item ID
      const matchesSearch = item['C']?.toLowerCase().includes(searchQuery.toLowerCase());  // Column C is Title
      console.log(`Item ${item['B']}: isSelected=${isSelected}, matchesSearch=${matchesSearch}`);
      return !isSelected && matchesSearch;
    });
    console.log('filtered items:', filtered);
    console.log('=== DEBUG END ===');
    return filtered;
  }, [allItems, selectedItems, searchQuery]);

  const addToRoutine = async (routineId, itemId) => {
    try {
      const response = await fetch(`/api/routines/${routineId}/items`, {
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

  const removeFromRoutine = async (routineId, routineEntryId) => {
    try {
      const response = await fetch(`/api/routines/${routineId}/items/${routineEntryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to remove item from routine');
      }
      
      // Update local state immediately for better UX
      setSelectedItems(prev => prev.filter(item => item.routineEntry['A'] !== routineEntryId));
      
      // Then refresh the routine to ensure sync with backend
      await fetchRoutine();
      return true;
    } catch (err) {
      console.error('Error removing item:', err);
      return false;
    }
  };

  const updateRoutineOrder = async (routineId, items) => {
    try {
      console.log('updateRoutineOrder called with:', {
        routineId,
        items
      });

      // Extract only the routine entry data for reordering
      const routineEntries = items.map(item => ({
        'A': item['A'],           // Routine entry ID
        'C': item['C']           // Order in routine
      }));

      console.log('Sending to backend:', routineEntries);

      const response = await fetch(`/api/routines/${routineId}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routineEntries)
      });

      console.log('Order update response:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Order update failed:', errorData);
        throw new Error(errorData.message || 'Failed to update routine order');
      }
      
      // Update local state with full item details
      setSelectedItems(prev => {
        const updated = [...prev];
        items.forEach(item => {
          const idx = updated.findIndex(i => i.routineEntry['A'] === item['A']);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              routineEntry: {
                ...updated[idx].routineEntry,
                'C': item['C']
              }
            };
          }
        });
        return updated;
      });

      // Refresh the routine to ensure sync with backend
      await fetchRoutine();

      console.log('Order update successful');
      return true;
    } catch (err) {
      console.error('Error updating order:', err);
      return false;
    }
  };

  return {
    availableItems,
    selectedItems,
    setSelectedItems,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    addToRoutine,
    removeFromRoutine,
    updateRoutineOrder,
  };
};