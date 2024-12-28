import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@hooks/useAuth';
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
const SortableItem = React.memo(({ item }) => {
  const [itemDetails, setItemDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItemDetails = async () => {
      try {
        const response = await fetch(`/api/items/${item['B']}`);
        if (!response.ok) throw new Error('Failed to fetch item details');
        const data = await response.json();
        setItemDetails(data);
      } catch (err) {
        console.error('Error fetching item details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItemDetails();
  }, [item['B']]);

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
        <span className="text-lg">
          {loading ? 'Loading...' : (itemDetails?.['C'] || `Item ${item['B']}`)}
        </span>
      </div>
      {item['D'] === 'TRUE' && (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      )}
    </div>
  );
});

const RoutinesPage = () => {
  const { isAuthenticated, checking, handleLogout } = useAuth();
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
  const inactiveRoutines = useMemo(() => routines.filter(r => !r.active), [routines]);

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
      const routine = routines.find(r => r.ID === routineId);
      if (!routine) return;
      
      const routineName = routine.routineName;
      const response = await fetch(`/api/routines/${routineName}/active`, {
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
  }, [routines, fetchRoutines]);

  const handleDeactivateRoutine = useCallback(async (routineId) => {
    try {
      const routine = routines.find(r => r.ID === routineId);
      if (!routine) return;

      const response = await fetch(`/api/routines/${routine.name}/active`, {
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
  }, [routines, fetchRoutines]);

  const handleDeleteClick = useCallback((routineId) => {
    setRoutineToDelete(routines.find(r => r.ID === routineId));
  }, [routines]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!routineToDelete) return;
    
    try {
      const response = await fetch(`/api/routines/${routineToDelete.name}`, {
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
    setEditingRoutine(routine);
    setIsEditOpen(true);
  }, []);

  const handleRoutineChange = useCallback(() => {
    console.log('Routine changed, refreshing list...'); // For debugging
    fetchRoutines();
  }, [fetchRoutines]);

  const fetchActiveRoutineItems = useCallback(async () => {
    if (!activeRoutine?.name) {
      setActiveRoutineItems([]);
      return;
    }

    try {
      const response = await fetch(`/api/routines/${activeRoutine.name}`);
      if (!response.ok) throw new Error('Failed to fetch routine items');
      const items = await response.json();
      setActiveRoutineItems(items);
    } catch (error) {
      console.error('Error fetching routine items:', error);
      setError(error.message);
    }
  }, [activeRoutine?.name]);

  useEffect(() => {
    if (activeRoutine?.name) {
      fetchActiveRoutineItems();
    }
  }, [activeRoutine?.name]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async ({ active, over }) => {
    setIsDragging(false);
    if (!active || !over || active.id === over.id) return;

    const oldIndex = activeRoutineItems.findIndex(item => item['A'] === active.id);
    const newIndex = activeRoutineItems.findIndex(item => item['A'] === over.id);

    try {
      // Create new array with moved item
      const reordered = arrayMove(activeRoutineItems, oldIndex, newIndex);
      
      // Update all orders to match new positions, keeping only essential columns
      const withNewOrder = reordered.map((item, index) => ({
        'A': item['A'],           // ID (routine entry ID)
        'B': item['B'],           // Item ID (reference to Items sheet)
        'C': index.toString(),    // Order
        'D': item['D'] || 'FALSE' // Completed
      }));
      
      // Update UI optimistically
      setActiveRoutineItems(withNewOrder);
      
      // Send update to backend
      const response = await fetch(`/api/routines/${activeRoutine.name}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withNewOrder)
      });
      
      if (!response.ok) throw new Error('Failed to update routine order');
      
      // Refresh items to ensure sync
      await fetchActiveRoutineItems();
    } catch (error) {
      console.error('Reorder failed:', error);
      // Revert to original order on error
      await fetchActiveRoutineItems();
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
                {/* New Routine Creation Form */}
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

                {/* Routines List */}
                <div className="space-y-2">
                {inactiveRoutines.map((routine) => (
                  <div 
                    key={routine.ID}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <span>{routine.name}</span>
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
                ))}
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
      />
    </>
  );
};

export default RoutinesPage;