import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { useAuth } from '@hooks/useAuth';
import { Textarea } from '@ui/textarea';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from '@ui/progress';

export const ImportsPage = () => {
  const { isAuthenticated } = useAuth();
  const [jsonInput, setJsonInput] = useState('');
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState({ imported: 0, total: 0 });

  const handleInputChange = (e) => {
    setJsonInput(e.target.value);
    setError(null);
    setSuccess(false);
    setProgress({ imported: 0, total: 0 });
    
    // Try to parse the JSON input
    if (e.target.value.trim()) {
      try {
        const parsed = JSON.parse(e.target.value);
        if (!Array.isArray(parsed)) {
          throw new Error('Input must be an array of items');
        }
        setImportData(parsed);
      } catch (err) {
        setError('Invalid JSON format: ' + err.message);
        setImportData(null);
      }
    } else {
      setImportData(null);
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setImporting(true);
    setError(null);
    setSuccess(false);
    setProgress({ imported: 0, total: importData.length });

    try {
      const response = await fetch('/api/items/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Even if there's an error, we might have partial success
        setProgress({ 
          imported: result.imported || 0, 
          total: importData.length 
        });
        throw new Error(result.error || 'Import failed');
      }

      setProgress({ 
        imported: result.imported, 
        total: importData.length 
      });
      setSuccess(true);
      setJsonInput('');
      setImportData(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-4xl bg-gray-900 text-gray-100">
        <CardContent className="pt-6">
          <div className="text-gray-400">Please log in to use import features</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl bg-gray-900 text-gray-100">
      <CardHeader>
        <CardTitle className="text-2xl">Import Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-gray-300">
            Import practice items from other sources. Items will be appended to your existing items.
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Paste your JSON data here..."
              value={jsonInput}
              onChange={handleInputChange}
              className="h-48 font-mono bg-gray-800"
              disabled={importing}
            />
            <div className="text-sm text-gray-400">
              Expected format: Array of objects with 'title' and 'duration' fields
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-900/20 p-4 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                {error}
                {progress.imported > 0 && (
                  <div className="text-sm mt-1">
                    Successfully imported {progress.imported} of {progress.total} items before error
                  </div>
                )}
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-500 bg-green-900/20 p-4 rounded-lg">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                Successfully imported {progress.imported} items!
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-sm text-gray-300">
                  Importing items... {progress.imported} of {progress.total}
                </div>
              </div>
              <Progress 
                value={(progress.imported / progress.total) * 100} 
                className="h-1 bg-gray-700"
              />
            </div>
          )}

          {importData && !importing && (
            <div className="space-y-2">
              <div className="text-gray-300">
                Preview: {importData.length} items to import
              </div>
              <div className="bg-gray-800 p-4 rounded-lg max-h-48 overflow-y-auto">
                {importData.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="text-sm text-gray-300">
                    • {item.title} ({item.duration} mins)
                  </div>
                ))}
                {importData.length > 5 && (
                  <div className="text-sm text-gray-500 mt-2">
                    ...and {importData.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!importData || importing}
              onClick={handleImport}
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </span>
              ) : (
                'Import Items'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ImportsPage; 