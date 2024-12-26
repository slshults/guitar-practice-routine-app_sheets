import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { usePracticeItems } from '@hooks/usePracticeItems';
import { ItemEditor } from './ItemEditor';
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

// Split out item component for better state isolation
const SortableItem = React.memo(({ item, onEdit, onDelete }) => {
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

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await onDelete(item.ID);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-5 rounded-lg ${
        isDragging ? 'bg-gray-700' : 'bg-gray-800'
      }`}
    >
      <div className="flex items-center">
        <div {...attributes} {...listeners}>
          <GripVertical className="h-6 w-6 text-gray-500 mr-4 cursor-move" />
        </div>
        <span className="text-xl">{item.Title}</span>
      </div>
      <div className="flex space-x-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => onEdit(item)}
          className="hover:bg-gray-700"
        >
          <Pencil className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={handleDelete}
          className="text-red-500 hover:text-red-400 hover:bg-gray-700"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
});

export const PracticeItemsList = () => {
  const { items, loading, error, deleteItem, updateItems, refreshItems } = usePracticeItems();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const handleDelete = async (itemId) => {
    if (isDragging) return; // Prevent delete during drag
    setIsDeleting(true);
    try {
      await deleteItem(itemId);
      await refreshItems(); // Force refresh
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setIsEditOpen(true);
  };

  const handleItemChange = async () => {
    await refreshItems();
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async ({ active, over }) => {
    setIsDragging(false);
    if (isDeleting || !active || !over || active.id === over.id) return;
  
    const oldIndex = items.findIndex(item => item.ID === active.id);
    const newIndex = items.findIndex(item => item.ID === over.id);
    
    try {
      // Create new array with moved item
      const reordered = arrayMove(items, oldIndex, newIndex);
      
      // Update all orders to match new positions
      const withNewOrder = reordered.map((item, index) => ({
        ...item,
        order: index
      }));
      
      // Send complete new state
      await updateItems(withNewOrder);
      
      // Force refresh
      await refreshItems();
    } catch (error) {
      console.error('Reorder failed:', error);
    }
  };

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

  const filteredItems = items.filter((item) =>
    item?.Title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="text-2xl text-center p-8">Loading practice items...</div>;
  if (error) return <div className="text-2xl text-red-500 text-center p-8">{error}</div>;

  return (
    <>
      <Card className="w-full max-w-4xl bg-gray-900 text-gray-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Practice Items</CardTitle>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8"
            onClick={() => {
              setEditingItem(null);
              setIsEditOpen(true);
            }}
          >
            <Plus className="mr-3 h-5 w-5" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-lg py-6 px-4"
              autocomplete="off"
            />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredItems.map(item => item.ID)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <SortableItem
                    key={item.ID}
                    item={item}
                    onEdit={handleEditClick}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <ItemEditor
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        item={editingItem}
        onItemChange={handleItemChange}
      />
    </>
  );
};