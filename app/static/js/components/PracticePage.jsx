import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { useActiveRoutine } from '@hooks/useActiveRoutine';
import { ChevronDown, ChevronRight, Check, Plus, Timer, FileText, RotateCcw } from 'lucide-react';
import { NoteEditor } from './NoteEditor';

// Custom Play icon with solid triangle
const PlayIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Custom Pause icon with solid bars
const PauseIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

// Custom Reset icon
const ResetIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
  </svg>
);

// Format seconds to MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const PracticePage = () => {
  const { routine, loading, error } = useActiveRoutine();
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [activeTimers, setActiveTimers] = useState(new Set());
  const [itemDetails, setItemDetails] = useState({});
  const completedItemIds = useMemo(() => {
    if (routine?.items) {
      return new Set(
        routine.items
          .filter(item => item['D'] === 'TRUE')  // Column D is completed status
          .map(item => item['A'])  // Column A is ID
      );
    }
    return new Set();
  });
  const [timers, setTimers] = useState({});
  const [notes, setNotes] = useState({});
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [editingNoteItemId, setEditingNoteItemId] = useState(null);
  
  // Create audio context for timer completion sound
  const audioContext = useRef(null);
  const oscillator = useRef(null);

  // Fetch notes for an item
  const fetchNotes = useCallback(async (itemId) => {
    try {
      const response = await fetch(`/api/items/${itemId}/notes`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      if (data.notes) {
        setNotes(prev => ({
          ...prev,
          [itemId]: data.notes
        }));
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  }, []);

  // Initialize timer for an item
  const initTimer = useCallback((itemId, duration) => {
    setTimers(prev => {
      if (!prev[itemId]) {
        return {
          ...prev,
          [itemId]: duration * 60 // Convert minutes to seconds
        };
      }
      return prev;
    });
  }, []);

  // Play meditation bell sound
  const playSound = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Stop previous sound if playing
    if (oscillator.current) {
      oscillator.current.stop();
      oscillator.current.disconnect();
    }

    // Create multiple oscillators for a rich bell sound
    const fundamentalFreq = 293.66; // D4 note (whole step up from middle C)
    const oscillators = [];
    const gains = [];
    
    // Frequencies for a bell-like sound (fundamental and harmonics)
    const frequencies = [
      fundamentalFreq,     // fundamental (D4)
      fundamentalFreq * 2, // octave (D5)
      fundamentalFreq * 3, // perfect fifth + octave
      fundamentalFreq * 4.2, // major third + 2 octaves (keeping original ratio for bell character)
    ];

    // Master gain for overall volume control
    const masterGain = audioContext.current.createGain();
    masterGain.gain.setValueAtTime(0.8, audioContext.current.currentTime);
    masterGain.connect(audioContext.current.destination);

    frequencies.forEach((freq, i) => {
      const osc = audioContext.current.createOscillator();
      const gain = audioContext.current.createGain();
      
      osc.type = i === 0 ? 'sine' : 'sine';
      osc.frequency.setValueAtTime(freq, audioContext.current.currentTime);
      
      // Set gain envelope for each component with longer sustain
      gain.gain.setValueAtTime(0, audioContext.current.currentTime);
      gain.gain.linearRampToValueAtTime(0.3 / (i + 1), audioContext.current.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.2 / (i + 1), audioContext.current.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.current.currentTime + 10);
      
      osc.connect(gain);
      gain.connect(masterGain);
      
      oscillators.push(osc);
      gains.push(gain);
      
      osc.start();
      osc.stop(audioContext.current.currentTime + 10);
    });

    // Store the primary oscillator for cleanup
    oscillator.current = oscillators[0];
  };

  // Timer tick effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;

        Object.entries(next).forEach(([itemId, time]) => {
          if (activeTimers.has(parseInt(itemId)) && time > 0) {
            next[itemId] = time - 1;
            changed = true;

            // Play sound when timer reaches 0
            if (next[itemId] === 0) {
              playSound();
              setActiveTimers(prev => {
                const next = new Set(prev);
                next.delete(parseInt(itemId));
                return next;
              });
            }
          }
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  // New function to fetch item details
  const fetchItemDetails = useCallback(async (itemId) => {
    try {
      const response = await fetch(`/api/items/${itemId}`);
      if (!response.ok) throw new Error('Failed to fetch item details');
      const data = await response.json();
      setItemDetails(prev => ({
        ...prev,
        [itemId]: data
      }));
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  }, []);

  // Modify toggleItem to fetch item details when expanding
  const toggleItem = (itemId) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        // Get the routine item
        const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
        if (routineItem) {
          // Fetch item details if we don't have them yet
          if (!itemDetails[routineItem['B']]) {  // Column B is Item ID
            fetchItemDetails(routineItem['B']);
          }
          // Initialize timer when expanding
          initTimer(itemId, itemDetails[routineItem['B']]?.Duration || 5);
          // Fetch notes when expanding
          fetchNotes(routineItem['B']);
        }
      }
      return next;
    });
  };

  const toggleTimer = (itemId, e) => {
    e?.stopPropagation(); // Prevent expand/collapse when clicking timer
    const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
    initTimer(itemId, itemDetails[routineItem?.['B']]?.Duration || 5);  // Column B is Item ID
    
    setActiveTimers(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleComplete = async (itemId, e) => {
    e?.stopPropagation(); // Prevent expand/collapse when clicking checkbox
    const newState = !completedItemIds.has(itemId);
    
    try {
      const response = await fetch(`/api/routines/${routine.name}/items/${itemId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: newState })
      });

      if (!response.ok) throw new Error('Failed to update completion state');

      setCompletedItems(prev => {
        const next = new Set(prev);
        if (newState) {
          next.add(itemId);
          // Stop timer when marking complete
          setActiveTimers(prev => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        } else {
          next.delete(itemId);
        }
        return next;
      });
    } catch (error) {
      console.error('Error updating completion state:', error);
    }
  };

  const resetTimer = (itemId, e) => {
    e?.stopPropagation();
    const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
    const duration = itemDetails[routineItem?.['B']]?.Duration || 5;  // Column B is Item ID
    setTimers(prev => ({
      ...prev,
      [itemId]: duration * 60
    }));
  };

  const addNote = async (itemId, e) => {
    e?.stopPropagation();
    setEditingNoteItemId(itemId);
    setIsNoteEditorOpen(true);
  };

  const handleNoteSave = async (noteText) => {
    await fetchNotes(editingNoteItemId);
    setEditingNoteItemId(null);
  };

  const toggleNotes = (itemId, e) => {
    e?.stopPropagation();
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const resetProgress = async (e) => {
    e?.stopPropagation();
    try {
      const response = await fetch(`/api/routines/${routine.name}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) throw new Error('Failed to reset progress');

      setCompletedItems(new Set());
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{routine?.name}</h1>
        <Button
          variant="outline"
          onClick={resetProgress}
          className="text-gray-300 hover:text-white"
        >
          Reset Progress
        </Button>
      </div>

      <div className="space-y-4">
        {routine?.items?.map((routineItem) => {
          const isExpanded = expandedItems.has(routineItem['A']);  // Column A is ID
          const isNotesExpanded = expandedNotes.has(routineItem['A']);
          const isTimerActive = activeTimers.has(routineItem['A']);
          const isCompleted = completedItemIds.has(routineItem['A']);
          const timeRemaining = timers[routineItem['A']] !== undefined 
            ? timers[routineItem['A']] 
            : (itemDetails[routineItem['B']]?.Duration || 5) * 60;  // Column B is Item ID
          const itemNotes = notes[routineItem['B']] || '';
          const item = itemDetails[routineItem['B']] || {};
          
          return (
            <div
              key={routineItem['A']}  // Column A is ID
              className="rounded-lg bg-gray-800 overflow-hidden"
            >
              <div 
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-700"
                onClick={() => toggleItem(routineItem['A'])}  // Column A is ID
              >
                <div className="flex items-center space-x-4">
                  <button
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-gray-400 text-transparent hover:border-gray-300'}`}
                    onClick={(e) => toggleComplete(routineItem['A'], e)}  // Column A is ID
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <span className={`text-xl ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                    {item['C'] || 'Loading...'}  {/* Column C is Title */}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-lg text-gray-400">{item['E'] || '...'} mins</span>  {/* Column E is Duration */}
                </div>
              </div>
              {isExpanded && (
                <div className="px-8 pb-6">
                  {/* Timer section */}
                  <div className="flex flex-col items-center justify-center py-8 space-y-6">
                    <button
                      onClick={(e) => toggleTimer(routineItem['A'], e)}  // Column A is ID
                      className="w-48 h-48 rounded-full border-4 border-gray-600 flex items-center justify-center hover:border-gray-500 transition-colors"
                    >
                      {isTimerActive ? (
                        <PauseIcon className="h-24 w-24 text-red-500" />
                      ) : (
                        <PlayIcon className="h-24 w-24 text-green-500" />
                      )}
                    </button>
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-5xl font-mono">
                        {formatTime(timeRemaining)}
                      </div>
                      {!isTimerActive && timeRemaining !== (item['E'] || 5) * 60 && (  // Column E is Duration
                        <button
                          onClick={(e) => resetTimer(routineItem['A'], e)}  // Column A is ID
                          className="flex items-center space-x-2 text-gray-400 hover:text-gray-300 transition-colors"
                        >
                          <ResetIcon className="h-4 w-4" />
                          <span>Reset Timer</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes section */}
                  <div className="mt-8 space-y-4">
                    {/* Description */}
                    <div className="space-y-2 px-4">
                      <h4 className="text-sm text-gray-400 flex items-center">
                        <Timer className="h-4 w-4 mr-2" />
                        Things to remember
                      </h4>
                      <p className="text-gray-500 italic">
                        {item['F'] || "You haven't added a description for this item yet."}  {/* Column F is Description */}
                      </p>
                    </div>

                    {/* Notes toggle */}
                    <div 
                      className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer"
                      onClick={(e) => toggleNotes(routineItem['A'], e)}  // Column A is ID
                    >
                      <div className="flex items-center">
                        {isNotesExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <h3 className="text-xl text-gray-300 flex items-center">
                          <FileText className="h-5 w-5 mr-2" />
                          Notes
                        </h3>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-gray-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          addNote(routineItem['B'], e);  // Column B is Item ID
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {itemNotes ? 'Edit note' : 'Add note'}
                      </Button>
                    </div>

                    {/* Collapsible notes content */}
                    {isNotesExpanded && itemNotes && (
                      <div className="px-4">
                        <div className="bg-gray-700 p-3 rounded">
                          <p className="text-gray-300 whitespace-pre-wrap">{itemNotes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mark as done button */}
                  <div className="mt-8">
                    <Button
                      variant="outline"
                      className="w-full text-gray-300 hover:text-white"
                      onClick={(e) => toggleComplete(routineItem['A'], e)}  // Column A is ID
                    >
                      Mark as done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 