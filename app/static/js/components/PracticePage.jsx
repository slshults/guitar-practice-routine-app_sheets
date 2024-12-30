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
  const [notes, setNotes] = useState({});
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [editingNoteItemId, setEditingNoteItemId] = useState(null);
  const [timers, setTimers] = useState({});
  
  const completedItemIds = useMemo(() => {
    if (routine?.items) {
      return new Set(
        routine.items
          .filter(item => item['D'] === 'TRUE')  // Column D is completed status
          .map(item => item['A'])  // Column A is routine entry ID
      );
    }
    return new Set();
  }, [routine]);

  const [completedItems, setCompletedItems] = useState(new Set());

  // Create audio context for timer completion sound
  const audioContext = useRef(null);
  const oscillator = useRef(null);
  const timerSound = useRef(null);

  // Timer countdown effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        activeTimers.forEach(itemId => {
          if (next[itemId] > 0) {
            next[itemId] = next[itemId] - 1;
            changed = true;
            console.log(`Timer ${itemId} ticked down to ${next[itemId]}`);
            
            // Play sound when timer hits zero
            if (next[itemId] === 0) {
              // Stop any currently playing sound
              if (timerSound.current) {
                timerSound.current.pause();
                timerSound.current.currentTime = 0;
              }
              
              // Create and play new sound
              timerSound.current = new Audio('/static/sound/timesUp.mp3');
              timerSound.current.play().catch(e => console.error('Error playing sound:', e));
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    console.log('Timer effect: Active timers:', Array.from(activeTimers));
    return () => {
      clearInterval(interval);
      // Clean up audio if it's playing
      if (timerSound.current) {
        timerSound.current.pause();
        timerSound.current = null;
      }
    };
  }, [activeTimers]);

  // Effect to sync completedItems with completedItemIds when routine changes
  useEffect(() => {
    setCompletedItems(completedItemIds);
  }, [completedItemIds]);

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
    console.log(`Initializing timer for item ${itemId} with duration ${duration} minutes`);
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

  // Modify toggleItem to use item details from routine data
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
          // Initialize timer using details that are now included
          initTimer(itemId, routineItem.details?.['E'] || 5);  // Column E is Duration
          // Fetch notes when expanding
          fetchNotes(routineItem['B']);  // Column B is Item ID
        }
      }
      return next;
    });
  };

  const toggleTimer = (itemId, e) => {
    e?.stopPropagation(); // Prevent expand/collapse when clicking timer
    const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
    if (routineItem) {
      // Stop any playing sound when timer controls are used
      if (timerSound.current) {
        timerSound.current.pause();
        timerSound.current.currentTime = 0;
        timerSound.current = null;
      }

      // Only initialize timer if it doesn't exist
      if (!timers[itemId]) {
        console.log(`Timer ${itemId} not found, initializing...`);
        initTimer(itemId, routineItem.details?.['E'] || 5);  // Column E is Duration
      } else {
        console.log(`Timer ${itemId} exists with value ${timers[itemId]}`);
      }
      
      setActiveTimers(prev => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          console.log(`Deactivating timer ${itemId}`);
          next.delete(itemId);
        } else {
          console.log(`Activating timer ${itemId}`);
          next.add(itemId);
        }
        return next;
      });
    }
  };

  const toggleComplete = async (routineEntryId, e) => {
    e?.stopPropagation(); // Prevent expand/collapse when clicking checkbox
    const newState = !completedItems.has(routineEntryId);
    
    try {
      const response = await fetch(`/api/routines/${routine.id}/items/${routineEntryId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: newState })
      });

      if (!response.ok) throw new Error('Failed to update completion state');

      const result = await response.json();
      if (result.success) {
        setCompletedItems(prev => {
          const next = new Set(prev);
          if (newState) {
            next.add(routineEntryId);
            // Stop timer when marking complete
            setActiveTimers(prev => {
              const next = new Set(prev);
              next.delete(routineEntryId);
              return next;
            });
          } else {
            next.delete(routineEntryId);
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Error updating completion state:', error);
    }
  };

  const resetTimer = (itemId, e) => {
    e?.stopPropagation();
    // Stop any playing sound when timer is reset
    if (timerSound.current) {
      timerSound.current.pause();
      timerSound.current.currentTime = 0;
      timerSound.current = null;
    }

    const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
    if (routineItem) {
      const duration = routineItem.details?.['E'] || 5;  // Column E is Duration
      setTimers(prev => ({
        ...prev,
        [itemId]: duration * 60
      }));
    }
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
      const response = await fetch(`/api/routines/${routine.id}/reset`, {
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
          const isCompleted = completedItems.has(routineItem['A']);  // Use routine entry ID for completion state
          const timerValue = timers[routineItem['A']] !== undefined 
            ? timers[routineItem['A']] 
            : (routineItem.details?.['E'] || 5) * 60;  // Column E is Duration
          const itemNotes = notes[routineItem['B']] || '';
          
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
                    {routineItem.details?.['C']}  {/* Column C is Title */}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  {routineItem.details?.['E'] && (  // Column E is Duration
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400"
                        onClick={(e) => toggleTimer(routineItem['A'], e)}
                      >
                        {activeTimers.has(routineItem['A']) ? (
                          <PauseIcon className="h-5 w-5" />
                        ) : (
                          <PlayIcon className="h-5 w-5" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400"
                        onClick={(e) => resetTimer(routineItem['A'], e)}
                      >
                        <ResetIcon className="h-5 w-5" />
                      </Button>
                      
                      <span className="text-lg font-mono">
                        {formatTime(timerValue)}
                      </span>
                    </div>
                  )}
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
                        {formatTime(timerValue)}
                      </div>
                      {!isTimerActive && timerValue !== (routineItem.details?.['E'] || 5) * 60 && (  // Column E is Duration
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
                        {routineItem.details?.['F'] || "You haven't added a description for this item yet."}  {/* Column F is Description */}
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
              {expandedItems.has(routineItem['A']) && (
                <div className="px-5 pb-5">
                  <div className="text-gray-400">
                    {routineItem.details?.['F']}  {/* Column F is Description */}
                  </div>
                  {routineItem.details?.['H'] && (  /* Column H is Tuning */
                    <div className="mt-2 text-gray-500">
                      Tuning: {routineItem.details['H']}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 