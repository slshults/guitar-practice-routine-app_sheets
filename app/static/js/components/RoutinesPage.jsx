import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@hooks/useAuth';
import { usePracticeItems } from '@hooks/usePracticeItems';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Plus, Pencil, X, CheckCircle2, GripVertical } from 'lucide-react';
import { RoutineEditor } from './RoutineEditor';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Sortable item component for active routine items
const SortableItem = React.memo(({ item, itemDetails }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item['A'] });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 rounded-lg ${
        isDragging ? 'bg-gray-700' : 'bg-gray-800'
      }`}
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5 text-gray-500 mr-4 cursor-move" />
        </div>
        <span className="text-lg">{itemDetails?.['C'] || `Item ${item['B']}`}</span>
      </div>
      {item['D'] === 'TRUE' && (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      )}
    </div>
  );
});

// Add SortableInactiveRoutine component near the top with other components
const SortableInactiveRoutine = React.memo(({ routine, handleActivateRoutine, handleEditClick, handleDeleteClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: routine.ID });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 ${
        isDragging ? 'bg-gray-700' : 'bg-gray-800'
      } rounded-lg`}
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5 text-gray-500 mr-4 cursor-move" />
        </div>
        <span>{routine.name}</span>
      </div>
      <div className="flex space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleActivateRoutine(routine.ID)}
          className="text-green-500 hover:text-green-400"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEditClick(routine)}
          className="text-blue-500 hover:text-blue-400"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-500 hover:text-red-400"
          onClick={() => handleDeleteClick(routine.ID)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

const RoutinesPage = () => {
  const { isAuthenticated, checking, handleLogout } = useAuth();
  const { items } = usePracticeItems();
  const [newRoutineName, setNewRoutineName] = useState('');
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routineToDelete, setRoutineToDelete] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [error, setError] = useState(null);
  const [activeRoutineItems, setActiveRoutineItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const activeRoutine = useMemo(() => routines.find(r => r.active), [routines]);
  const inactiveRoutines = useMemo(() => 
    routines
      .filter(r => !r.active)
      .sort((a, b) => Number(a.order) - Number(b.order)), 
    [routines]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchRoutines = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/routines');
      if (!response.ok) throw new Error('Failed to fetch routines');
      const routinesList = await response.json();
      setRoutines(routinesList);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleActivateRoutine = useCallback(async (routineId) => {
    try {
      const response = await fetch(`/api/routines/${routineId}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true })
      });
  
      if (!response.ok) throw new Error('Failed to activate routine');
      await fetchRoutines();
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    }
  }, [fetchRoutines]);

  const handleDeactivateRoutine = useCallback(async (routineId) => {
    try {
      const response = await fetch(`/api/routines/${routineId}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      });

      if (!response.ok) throw new Error('Failed to deactivate routine');
      await fetchRoutines();
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    }
  }, [fetchRoutines]);

  const handleDeleteClick = useCallback((routineId) => {
    setRoutineToDelete(routines.find(r => r.ID === routineId));
  }, [routines]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!routineToDelete) return;
    
    try {
      const response = await fetch(`/api/routines/${routineToDelete.ID}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete routine');
      await fetchRoutines();
    } catch (error) {
      console.error('Failed to delete routine:', error);
      setError(error.message);
    } finally {
      setRoutineToDelete(null);
    }
  }, [routineToDelete, fetchRoutines]);

  const handleCreateRoutine = useCallback(async () => {
    if (!newRoutineName.trim()) return;
    
    try {
      const response = await fetch('/api/routines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routineName: newRoutineName.trim() }),
      });
      
      if (!response.ok) throw new Error('Failed to create routine');
      await fetchRoutines();
      setNewRoutineName('');
    } catch (error) {
      console.error('Failed to create routine:', error);
      setError(error.message);
    }
  }, [newRoutineName, fetchRoutines]);

  const handleEditClick = useCallback((routine) => {
    console.log('Editing routine:', routine); // For debugging
    
    // Find the active routine details if this is the active routine
    const routineDetails = routine.active ? {
      id: routine.ID,
      name: routine.name,
      items: activeRoutineItems.map(item => ({
        routineEntry: item,
        itemDetails: item.itemDetails
      }))
    } : null;

    setEditingRoutine({
      id: routine.ID,
      name: routine.name,
      details: routineDetails
    });
    setIsEditOpen(true);
  }, [activeRoutineItems]);

  const handleRoutineChange = useCallback(() => {
    console.log('Routine changed, refreshing list...'); // For debugging
    fetchRoutines();
  }, [fetchRoutines]);

  const fetchActiveRoutineItems = useCallback(async () => {
    try {
      // Get active routine ID from the routines list instead of making a separate call
      const activeRoutine = routines.find(r => r.active);
      
      if (!activeRoutine) {
        setActiveRoutineItems([]);
        return;
      }

      // Fetch the routine with all details
      const routineResponse = await fetch(`/api/routines/${activeRoutine.ID}/details`);
      if (!routineResponse.ok) throw new Error('Failed to fetch routine details');
      const routineData = await routineResponse.json();
      
      // Sort items by order
      const sortedItems = routineData.items
        .sort((a, b) => parseInt(a.routineEntry['C']) - parseInt(b.routineEntry['C']))
        .map(item => ({
          ...item.routineEntry,
          itemDetails: item.itemDetails
        }));
      
      setActiveRoutineItems(sortedItems);
    } catch (error) {
      console.error('Error fetching routine items:', error);
      setError(error.message);
    }
  }, [routines]);

  useEffect(() => {
    fetchActiveRoutineItems();
  }, [fetchActiveRoutineItems]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async ({ active, over }) => {
    setIsDragging(false);
    if (!active || !over || active.id === over.id) return;

    const oldIndex = activeRoutineItems.findIndex(item => item['A'] === active.id);
    const newIndex = activeRoutineItems.findIndex(item => item['A'] === over.id);

    try {
      // First get the active routine ID
      const response = await fetch('/api/routines/active');
      if (!response.ok) throw new Error('Failed to fetch active routine');
      const data = await response.json();
      const activeId = data.active_id;
      
      if (!activeId) {
        throw new Error('No active routine found');
      }

      // Create new array with moved item
      const reordered = arrayMove(activeRoutineItems, oldIndex, newIndex);
      
      // Update all orders to match new positions, keeping only essential columns
      const withNewOrder = reordered.map((item, index) => ({
        'A': item['A'],           // ID (routine entry ID)
        'C': index.toString(),    // Order
      }));
      
      // Update UI optimistically
      setActiveRoutineItems(reordered);
      
      // Send update to backend using the active routine ID as sheet name
      const orderResponse = await fetch(`/api/routines/${activeId}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withNewOrder)
      });
      
      if (!orderResponse.ok) throw new Error('Failed to update routine order');
      
      // Refresh items to ensure sync
      await fetchActiveRoutineItems();
    } catch (error) {
      console.error('Reorder failed:', error);
      // Revert to original order on error
      await fetchActiveRoutineItems();
    }
  };

  const handleDragEndInactive = async ({ active, over }) => {
    if (!active || !over || active.id === over.id) return;

    const oldIndex = inactiveRoutines.findIndex(routine => routine.ID === active.id);
    const newIndex = inactiveRoutines.findIndex(routine => routine.ID === over.id);

    try {
      // Create new array with moved item
      const reordered = arrayMove(inactiveRoutines, oldIndex, newIndex);
      
      // Just swap the order values between the moved items
      const updates = [
        {
          'A': reordered[newIndex].ID,
          'D': inactiveRoutines[newIndex].order
        },
        {
          'A': inactiveRoutines[newIndex].ID,
          'D': reordered[newIndex].order
        }
      ];
      
      // Update UI optimistically
      setRoutines(prevRoutines => {
        return prevRoutines.map(routine => {
          const update = updates.find(u => u.A === routine.ID);
          if (update) {
            return { ...routine, order: update.D };
          }
          return routine;
        });
      });
      
      // Send update to backend
      const orderResponse = await fetch('/api/routines/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!orderResponse.ok) throw new Error('Failed to update routine order');
      
      // Refresh routines to ensure sync
      await fetchRoutines();
    } catch (error) {
      console.error('Reorder failed:', error);
      // Revert to original order on error
      await fetchRoutines();
    }
  };

  useEffect(() => {
    if (!checking) {
      setLoading(true);
      fetchRoutines();
    }
  }, [checking, fetchRoutines]);

  if (checking) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl mb-4">Checking authentication...</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl mb-4">Loading routines...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl text-red-500 mb-4">Error: {error}</h2>
        <Button onClick={fetchRoutines} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl mb-4">Please log in to manage routines</h2>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Routine Section */}
        <Card className="bg-gray-900 text-gray-100">
          <CardHeader>
            <CardTitle>Current Active Routine</CardTitle>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              activeRoutine ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                      {activeRoutine.name}
                    </span>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(activeRoutine)}
                        className="text-blue-500 hover:text-blue-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivateRoutine(activeRoutine.ID)}
                        className="text-gray-400 hover:text-gray-200"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={activeRoutineItems.map(item => item['A'])}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2 mt-4">
                        {activeRoutineItems.map((item) => (
                          <SortableItem
                            key={item['A']}
                            item={item}
                            itemDetails={item.itemDetails}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <div className="text-gray-400">No active routine selected</div>
              )
            ) : (
              <div className="text-gray-400">Please log in to manage routines</div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Routines Section */}
        <Card className="bg-gray-900 text-gray-100">
          <CardHeader>
            <CardTitle>Inactive Routines</CardTitle>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              <>
                {/* Routines List */}
                <div className="space-y-2">
                  <div className="mb-4 flex space-x-2">
                    <Input
                      placeholder="New Routine Name"
                      value={newRoutineName}
                      onChange={(e) => setNewRoutineName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateRoutine()}
                      className="flex-grow"
                    />
                    <Button 
                      onClick={handleCreateRoutine}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={!newRoutineName.trim()}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add
                    </Button>
                  </div>
                  
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndInactive}
                  >
                    <SortableContext
                      items={inactiveRoutines.map(routine => routine.ID)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {inactiveRoutines.map((routine) => (
                          <SortableInactiveRoutine
                            key={routine.ID}
                            routine={routine}
                            handleActivateRoutine={handleActivateRoutine}
                            handleEditClick={handleEditClick}
                            handleDeleteClick={handleDeleteClick}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            ) : (
              <div className="text-gray-400">Please log in to manage routines</div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={!!routineToDelete} 
          onOpenChange={(isOpen) => {
            if (!isOpen) setRoutineToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Routine</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{routineToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <RoutineEditor
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        routine={editingRoutine}
        onRoutineChange={handleRoutineChange}
        items={items}
      />
    </>
  );
};

export default RoutinesPage;