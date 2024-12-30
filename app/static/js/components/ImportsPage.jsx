import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Textarea } from '@ui/textarea';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ImportsPage() {
    const [itemsData, setItemsData] = useState('');
    const [routinesData, setRoutinesData] = useState('');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleItemsImport = async () => {
        try {
            // Parse the JSON data
            const items = JSON.parse(itemsData);
            
            // Send to backend
            const response = await fetch('/api/items/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(items),
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to import items');
            }
            
            setMessage(`Successfully imported ${result.imported} items!`);
            setItemsData('');  // Clear the textarea
            setError(null);
        } catch (err) {
            setError(err.message);
            setMessage(null);
        }
    };

    const handleRoutinesImport = async () => {
        try {
            // Parse the JSON data
            const routines = JSON.parse(routinesData);
            
            // Send to backend
            const response = await fetch('/api/routines/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(routines),
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to import routines');
            }
            
            setMessage(`Successfully imported ${result.imported} routines!`);
            setRoutinesData('');  // Clear the textarea
            setError(null);
        } catch (err) {
            setError(err.message);
            setMessage(null);
        }
    };

    return (
        <Card className="w-full max-w-4xl bg-gray-900 text-gray-100">
            <CardContent className="space-y-6">
                <div>
                    <CardTitle className="text-2xl mb-4">Import Items</CardTitle>
                    <p className="text-gray-300 mb-4">Import practice items from other sources. Items will be appended to your existing items.</p>
                    <Textarea
                        value={itemsData}
                        onChange={(e) => setItemsData(e.target.value)}
                        placeholder="Paste your JSON data here..."
                        className="h-48 font-mono bg-gray-800 mb-2"
                    />
                    <p className="text-sm text-gray-400 mb-4">Expected format: Array of objects with 'title' and 'duration' fields</p>
                    <Button 
                        onClick={handleItemsImport}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Import Items
                    </Button>
                </div>

                <div>
                    <CardTitle className="text-2xl mb-4">Import Routines</CardTitle>
                    <p className="text-gray-300 mb-4">Import practice routines. Each routine will be created as a new routine.</p>
                    <Textarea
                        value={routinesData}
                        onChange={(e) => setRoutinesData(e.target.value)}
                        placeholder="Paste your JSON data here..."
                        className="h-48 font-mono bg-gray-800 mb-2"
                    />
                    <p className="text-sm text-gray-400 mb-4">Expected format: Array of objects with 'name' field</p>
                    <Button 
                        onClick={handleRoutinesImport}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Import Routines
                    </Button>
                </div>

                {message && (
                    <div className="flex items-center gap-2 text-green-500 bg-green-900/20 p-4 rounded-lg">
                        <CheckCircle className="h-5 w-5 flex-shrink-0" />
                        <div>{message}</div>
                    </div>
                )}
                
                {error && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-900/20 p-4 rounded-lg">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <div>{error}</div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
} 