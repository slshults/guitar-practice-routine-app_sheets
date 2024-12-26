import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { Label } from '@ui/label';

export const ItemEditor = ({ open, onOpenChange, item = null, onItemChange }) => {
  const [formData, setFormData] = useState({
    Title: '',
    Notes: '',
    Duration: 5,
    Description: '',
    Tuning: '',
  });
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Clear error and load item data when modal opens
  useEffect(() => {
    if (open && item) {
      setFormData({
        Title: item.Title || '',
        Notes: item.Notes || '',
        Duration: item.Duration || 5,
        Description: item.Description || '',
        Tuning: item.Tuning || '',
      });
      setError(null);
      setIsDirty(false);
    }
  }, [open, item]);

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/items/${item?.ID || ''}`, {
        method: item ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save item');
      }

      const savedItem = await response.json();
      onItemChange?.(savedItem);
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
      console.error('Save error:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-800">
        <DialogHeader>
          <DialogTitle>
            {item ? `Edit Item: ${item.Title}` : 'Create New Item'}
          </DialogTitle>
          <DialogDescription>
            Edit the details of your practice item
          </DialogDescription>
          {error && (
            <div className="mt-2 text-sm text-red-500">
              {error}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.Title}
              onChange={(e) => handleFormChange('Title', e.target.value)}
              placeholder="Enter item title"
              required
              className="bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={formData.Duration}
              onChange={(e) => handleFormChange('Duration', parseInt(e.target.value) || 5)}
              required
              className="bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.Description}
              onChange={(e) => handleFormChange('Description', e.target.value)}
              placeholder="Enter item description"
              className="h-24 bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tuning">Tuning</Label>
            <Input
              id="tuning"
              value={formData.Tuning}
              onChange={(e) => handleFormChange('Tuning', e.target.value)}
              placeholder="e.g. EADGBE"
              className="bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.Notes}
              onChange={(e) => handleFormChange('Notes', e.target.value)}
              placeholder="Enter any notes"
              className="h-24 bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={isDirty ? "outline" : "secondary"}>
              {item ? 'Save' : 'Create Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemEditor; 