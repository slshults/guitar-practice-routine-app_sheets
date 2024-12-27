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
    'C': '',
    'D': '',
    'E': 5,
    'F': '',
    'G': '',
    'H': '',
  });
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  // Clear error and load item data when modal opens
  useEffect(() => {
    if (open && item) {
      setFormData({
        'C': item['C'] || '',
        'D': item['D'] || '',
        'E': item['E'] || 5,
        'F': item['F'] || '',
        'G': item['G'] || '',
        'H': item['H'] || '',
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
      const { G, ...dataToSend } = formData;
      
      // Ensure no trailing slash and handle empty item ID case
      const baseUrl = '/api/items';
      const url = item?.['A'] ? `${baseUrl}/${item['A']}` : baseUrl;
      
      console.log("Sending request to:", url);
      const response = await fetch(url, {
        method: item ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save item');
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
            {item ? `Edit Item: ${item['C']}` : 'Create New Item'}
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
              value={formData['C']}
              onChange={(e) => handleFormChange('C', e.target.value)}
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
              value={formData['E']}
              onChange={(e) => handleFormChange('E', parseInt(e.target.value) || 5)}
              required
              className="bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData['F']}
              onChange={(e) => handleFormChange('F', e.target.value)}
              placeholder="Enter item description"
              className="h-24 bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tuning">Tuning</Label>
            <Input
              id="tuning"
              value={formData['H']}
              onChange={(e) => handleFormChange('H', e.target.value)}
              placeholder="e.g. EADGBE"
              className="bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData['D']}
              onChange={(e) => handleFormChange('D', e.target.value)}
              placeholder="Enter any notes"
              className="h-24 bg-gray-900 text-white"
              autocomplete="off"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-gray-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!isDirty}
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemEditor; 