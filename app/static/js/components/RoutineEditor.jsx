// app/static/js/components/RoutineEditor.jsx
import React, { useState, useEffect } from 'react';
import { useRoutineEditor } from '@hooks/useRoutineEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Search, Plus, GripVertical, X } from 'lucide-react';
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

// Available item in the search list
const AvailableItem = React.memo(({ item, onAdd }) => (
  <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
    <span className="text-lg">{item.Title}</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onAdd(item)}
      className="text-blue-500 hover:text-blue-400"
    >
      <Plus className="h-4 w-4" />
    </Button>
  </div>
));

// Sortable item component for selected items
const SortableRoutineItem = React.memo(({ item, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.ID });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-4 ${
        isDragging ? 'bg-gray-700' : 'bg-gray-800'
      } rounded-lg`}
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5 text-gray-500 mr-4 cursor-move" />
        </div>
        <span className="text-lg">{item.Title}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(item.ID)}
        className="text-red-500 hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});

export const RoutineEditor = ({ open, onOpenChange, routine = null, onRoutineChange }) => {
  const {
    availableItems,
    selectedItems,
    searchQuery,
    setSearchQuery,
    loading,
    error: hookError,
    addToRoutine,
    removeFromRoutine,
    updateRoutineOrder,
    createRoutine,
  } = useRoutineEditor(routine?.name);

  const [newRoutineName, setNewRoutineName] = useState(routine?.name || '');
  const [error, setError] = useState(null);

  // Clear error when modal opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

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

  const handleDragEnd = async ({ active, over }) => {
    if (active.id !== over?.id) {
      const oldIndex = selectedItems.findIndex(item => item.ID === active.id);
      const newIndex = selectedItems.findIndex(item => item.ID === over.id);
      
      const reordered = arrayMove(selectedItems, oldIndex, newIndex);
      if (routine?.name) {
        await updateRoutineOrder(routine.name, reordered);
      }
    }
  };

  const handleAddItem = async (item) => {
    try {
      setError(null);
      if (!routine?.name) {
        // For new routines, just update local state
        setSelectedItems(prev => [...prev, item]);
      } else {
        // For existing routines, call API through the hook
        const success = await addToRoutine(routine.name, item.ID);
        if (!success) {
          throw new Error('Failed to add item to routine');
        }
        // Notify parent of change
        onRoutineChange?.();
      }
    } catch (err) {
      setError(err.message);
      console.error('Error adding item:', err);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      setError(null);
      if (!routine?.name) {
        // For new routines, just update local state
        setSelectedItems(prev => prev.filter(item => item.ID !== itemId));
      } else {
        // For existing routines, call API through the hook
        const success = await removeFromRoutine(routine.name, itemId);
        if (!success) {
          throw new Error('Failed to remove item from routine');
        }
        // Notify parent of change
        onRoutineChange?.();
      }
    } catch (err) {
      setError(err.message);
      console.error('Error removing item:', err);
    }
  };

  if (loading) return <div className="text-2xl text-center p-8">Loading...</div>;
  if (hookError) return <div className="text-2xl text-red-500 text-center p-8">{hookError}</div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {routine ? `Edit Routine: ${routine.name}` : 'Create New Routine'}
          </DialogTitle>
          <DialogDescription>
            Add or remove items and arrange them in your preferred order
          </DialogDescription>
          {error && (
            <div className="mt-2 text-sm text-red-500">
              {error}
            </div>
          )}
        </DialogHeader>

        <div className="flex gap-8 h-[60vh]">
          {/* Available Items */}
          <Card className="w-1/2 bg-gray-900">
            <CardHeader>
              <CardTitle>Available Items</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  className="pl-9"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autocomplete="off"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto h-[calc(100%-100px)]">
              {availableItems.map(item => (
                <AvailableItem
                  key={item.ID}
                  item={item}
                  onAdd={handleAddItem}
                />
              ))}
            </CardContent>
          </Card>

          {/* Selected Items */}
          <Card className="w-1/2 bg-gray-900">
            <CardHeader>
              <CardTitle>Selected Items</CardTitle>
              {!routine?.name && (
                <Input
                  placeholder="Enter routine name..."
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                  className="mt-2"
                  autocomplete="off"
                />
              )}
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto h-[calc(100%-100px)]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedItems.map(item => item.ID)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {selectedItems.map((item) => (
                      <SortableRoutineItem
                        key={item.ID}
                        item={item}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default RoutineEditor;