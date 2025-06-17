import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { useActiveRoutine } from '@hooks/useActiveRoutine';
import { ChevronDown, ChevronRight, Check, Plus, Timer, FileText, RotateCcw, Book, Music } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { ChordChartEditor } from './ChordChartEditor';

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

// Format minutes to HH:MM
const formatHoursAndMinutes = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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
  const [expandedChords, setExpandedChords] = useState(new Set());
  const chordChartRefs = useRef({});
  const [chordCharts, setChordCharts] = useState({});
  const [showChordEditor, setShowChordEditor] = useState({});

  // Add some test chord charts for development
  useEffect(() => {
    if (routine?.items?.length > 0) {
      const firstItemId = routine.items[0]['A'];
      setChordCharts(prev => ({
        ...prev,
        [firstItemId]: [
          {
            id: 'test1',
            chordName: 'C',
            section: 'Verse',
            tuning: 'EADGBE',
            position: 1,
            fretPositions: [0, 1, 0, 2, 3, 0]
          },
          {
            id: 'test2', 
            chordName: 'G',
            section: 'Chorus',
            tuning: 'EADGBE',
            position: 3,
            fretPositions: [3, 2, 0, 0, 3, 3]
          }
        ]
      }));
    }
  }, [routine]);
  
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
  const gainNode = useRef(null);
  const timerSound = useRef(null);
  const audioBuffer = useRef(null);

  // Initialize Web Audio API context and nodes
  useEffect(() => {
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create gain node
    gainNode.current = audioContext.current.createGain();
    gainNode.current.gain.value = 3.0;  // Competing with electric guitar! 🎸

    // Connect nodes
    gainNode.current.connect(audioContext.current.destination);

    // Load and decode audio file
    fetch('/static/sound/timesUp.mp3')
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.current.decodeAudioData(arrayBuffer))
      .then(decodedBuffer => {
        audioBuffer.current = decodedBuffer;
      })
      .catch(e => console.error('Error loading sound:', e));

    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

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
                timerSound.current.stop();
              }
              
              // Create and play new sound using Web Audio API
              if (audioBuffer.current && audioContext.current) {
                timerSound.current = audioContext.current.createBufferSource();
                timerSound.current.buffer = audioBuffer.current;
                timerSound.current.connect(gainNode.current);
                timerSound.current.start();
              }
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
        timerSound.current.stop();
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
        timerSound.current.stop();
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

            // When marking as complete:
            // 1. Find the current item's index
            const currentIndex = routine.items.findIndex(item => item['A'] === routineEntryId);
            // 2. Collapse current item
            setExpandedItems(prev => {
              const next = new Set(prev);
              next.delete(routineEntryId);
              // 3. If there's a next item, expand it
              if (currentIndex < routine.items.length - 1) {
                const nextItem = routine.items[currentIndex + 1];
                next.add(nextItem['A']);
                // Initialize timer and fetch notes for next item
                initTimer(nextItem['A'], nextItem.details?.['E'] || 5);
                fetchNotes(nextItem['B']);
              }
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
      timerSound.current.stop();
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

  // Calculate total and completed minutes
  const { totalMinutes, completedMinutes } = useMemo(() => {
    if (!routine?.items) return { totalMinutes: 0, completedMinutes: 0 };
    
    const total = routine.items.reduce((sum, item) => {
      const duration = parseInt(item.details?.['E']) || 0;
      return sum + duration;
    }, 0);
    
    const completed = routine.items
      .filter(item => completedItems.has(item['A']))
      .reduce((sum, item) => {
        const duration = parseInt(item.details?.['E']) || 0;
        return sum + duration;
      }, 0);
    
    return { totalMinutes: total, completedMinutes: completed };
  }, [routine, completedItems]);

  // Effect to handle chord chart initialization
  useEffect(() => {
    // Load SVGuitar UMD script if not already loaded
    if (!window.svguitar) {
      const script = document.createElement('script');
      script.src = 'https://omnibrain.github.io/svguitar/js/svguitar.umd.js';
      script.async = true;
      script.onload = () => {
        initializeCharts();
      };
      document.body.appendChild(script);
    } else {
      initializeCharts();
    }

    function initializeCharts() {
      expandedChords.forEach(itemId => {
        // Get all charts for this item
        const itemCharts = chordCharts[itemId] || [];
        
        itemCharts.forEach(chartData => {
          const container = document.getElementById(`chord-chart-${itemId}-${chartData.id}`);
          if (!container || chordChartRefs.current[`${itemId}-${chartData.id}`]) return;

          try {
            const chart = new window.svguitar.SVGuitarChord(`#chord-chart-${itemId}-${chartData.id}`);

            chart
              .configure({
                strings: 6,
                frets: 5,
                position: chartData.position || 1,
                tuning: chartData.tuning.split(''),
                fretLabelPosition: 'right',
                fretLabelFontSize: 6,
                width: 70,
                height: 85,
                stringLabelFontSize: 7,
                fretNumbersFontSize: 7,
                stringWidth: 0.6,
                fretWidth: 0.6,
                strokeWidth: 0.6,
              })
              .chord({
                fingers: chartData.fretPositions.map((pos, idx) => [idx + 1, pos]),
                barres: []
              })
              .draw();

            chordChartRefs.current[`${itemId}-${chartData.id}`] = chart;
            
            // Remove hardcoded width/height attributes and fix with CSS
            const svg = container.querySelector('svg');
            if (svg) {
              svg.removeAttribute('width');
              svg.removeAttribute('height');
              svg.style.width = '100%';
              svg.style.height = '100%';
              svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
          } catch (error) {
            console.error('Error initializing chord chart:', error);
          }
        });
      });
    }

    // Cleanup function
    return () => {
      expandedChords.forEach(itemId => {
        const itemCharts = chordCharts[itemId] || [];
        itemCharts.forEach(chart => {
          const refKey = `${itemId}-${chart.id}`;
          if (chordChartRefs.current[refKey]) {
            const container = document.getElementById(`chord-chart-${itemId}-${chart.id}`);
            if (container) {
              container.innerHTML = '';
            }
            delete chordChartRefs.current[refKey];
          }
        });
      });
    };
  }, [expandedChords, chordCharts]);

  const toggleChords = (itemId, e) => {
    e?.stopPropagation();
    setExpandedChords(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSaveChordChart = (itemId, chartData) => {
    setChordCharts(prev => {
      const itemCharts = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: [...itemCharts, { ...chartData, id: Date.now() }]
      };
    });
    // Hide the editor after saving
    setShowChordEditor(prev => ({
      ...prev,
      [itemId]: false
    }));
  };

  const toggleChordEditor = (itemId, e) => {
    e?.stopPropagation();
    setShowChordEditor(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{routine?.name}</h1>
        <div className="flex flex-col items-end gap-2">
          <div className="text-xl font-mono">
            {formatHoursAndMinutes(completedMinutes)} / {formatHoursAndMinutes(totalMinutes - completedMinutes)}
          </div>
          <Button
            variant="outline"
            onClick={resetProgress}
            className="text-gray-300 hover:text-white"
          >
            Reset Progress
          </Button>
        </div>
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
          const isChordsExpanded = expandedChords.has(routineItem['A']);
          
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
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isCompleted 
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

                  {/* Description */}
                  <div className="space-y-2 px-4">
                    {/* Chord Charts toggle */}
                    <div 
                      className="flex items-center justify-between p-2 hover:bg-gray-700 rounded cursor-pointer"
                      onClick={(e) => toggleChords(routineItem['A'], e)}
                    >
                      <div className="flex items-center">
                        {isChordsExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <h3 className="text-xl text-gray-300 flex items-center">
                          <Music className="h-5 w-5 mr-2" />
                          Chord Charts
                        </h3>
                      </div>
                    </div>

                    {/* Collapsible chord chart content */}
                    {isChordsExpanded && (
                      <div className="bg-gray-700 rounded-lg p-4">
                        {/* Display existing chord charts */}
                        {chordCharts[routineItem['A']]?.length > 0 && (
                          <div className="mb-4 space-y-4">
                            {Object.entries(
                              chordCharts[routineItem['A']]?.reduce((acc, chart) => {
                                if (!acc[chart.section]) acc[chart.section] = [];
                                acc[chart.section].push(chart);
                                return acc;
                              }, {}) || {}
                            ).map(([section, charts]) => (
                              <div key={section} className="space-y-2">
                                <h4 className="text-lg font-semibold text-gray-300">{section}</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                  {charts.map(chart => (
                                    <div key={chart.id} className="bg-gray-800 p-2 rounded">
                                      <div className="text-sm font-mono mb-2">{chart.chordName}</div>
                                      <div className="relative w-20 h-24 mx-auto">
                                        <div id={`chord-chart-${routineItem['A']}-${chart.id}`} className="absolute inset-0">
                                          {/* SVGuitar chart will be rendered here */}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Toggle for chord editor */}
                        <Button
                          variant="outline"
                          onClick={(e) => toggleChordEditor(routineItem['A'], e)}
                          className="w-full mb-4"
                        >
                          {showChordEditor[routineItem['A']] ? 'Hide Chord Editor' : 'Add New Chord'}
                        </Button>

                        {/* Chord editor */}
                        {showChordEditor[routineItem['A']] && (
                          <ChordChartEditor
                            defaultTuning={routineItem.details?.['H'] || 'EADGBE'}
                            onSave={(chartData) => handleSaveChordChart(routineItem['A'], chartData)}
                          />
                        )}
                      </div>
                    )}

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

                    {/* Tuning and Songbook section */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        {/* Songbook folder link */}
                        {routineItem.details?.['F'] && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch('/api/open-folder', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ path: routineItem.details['F'] })
                              }).catch(err => console.error('Error opening folder:', err));
                            }}
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center"
                          >
                            <Book className="h-4 w-4 mr-2" />
                            Open Songbook Folder
                          </button>
                        )}
                        {/* Tuning */}
                        {routineItem.details?.['H'] && (
                          <span className="text-sm font-mono font-bold text-gray-400">
                            {routineItem.details['H']}
                          </span>
                        )}
                      </div>
                    </div>
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
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add NoteEditor */}
      <NoteEditor
        open={isNoteEditorOpen}
        onOpenChange={setIsNoteEditorOpen}
        itemId={editingNoteItemId}
        currentNote={editingNoteItemId ? notes[editingNoteItemId] : ''}
        onNoteSave={handleNoteSave}
      />
    </div>
  );
}; 