import React, { useEffect, useCallback, useState, useRef, useMemo, memo } from 'react';

// Simple debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
import { Button } from '@ui/button';
import { useActiveRoutine } from '@hooks/useActiveRoutine';
import { useItemDetails } from '@hooks/useItemDetails';
import { usePracticeItems } from '@hooks/usePracticeItems';
import { ChevronDown, ChevronRight, Check, Plus, FileText, Book, Music } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { ChordChartEditor } from './ChordChartEditor';
import { serverDebug, serverInfo } from '../utils/logging';

// Import at top to activate console overrides
import '../utils/logging';

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

// Memoized chord chart component that only re-renders when chord data changes
const MemoizedChordChart = memo(({ chart, onEdit, onDelete }) => {
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const renderChart = () => {
      if (!window.svguitar || !chartRef.current) return;

      try {
        // Handle nested chordData structure if present
        const actualChartData = chart.chordData || chart;
        
        // Clear any existing content
        chartRef.current.innerHTML = '';

        // Create SVGuitar instance
        const chartInstance = new window.svguitar.SVGuitarChord(chartRef.current);
        
        // Configure the chart with same dimensions as editor for consistency
        const config = {
          strings: actualChartData.numStrings || 6,
          frets: actualChartData.numFrets || 5,
          position: actualChartData.startingFret || 1,
          tuning: [], // Hide tuning labels in the small display
          width: 220,             // Match editor dimensions
          height: 310,            // Match editor dimensions
          fretSize: 1.2,          // Match editor settings
          fingerSize: 0.75,       // Larger finger size for text visibility (match editor)
          sidePadding: 0.2,       // Match editor settings
          fontFamily: 'Arial',
          // Dark theme colors
          color: '#ffffff',           // White finger dots
          backgroundColor: 'transparent',
          strokeColor: '#ffffff',     // White grid lines
          textColor: '#ffffff',       // White text
          fretLabelColor: '#ffffff',  // White fret labels
          // Finger text settings (match editor)
          fingerTextColor: '#000000', // Black text on white dots for contrast
          fingerTextSize: 28         // Larger text size for visibility (match editor)
        };

        // Combine regular fingers with open and muted strings (same as in editor)
        // Process fingers to ensure proper finger number format for SVGuitar
        const processedFingers = (actualChartData.fingers || []).map(finger => {
          const [string, fret, fingerNumber] = finger;
          // Only include finger number if it's defined and not empty
          if (fingerNumber && fingerNumber !== 'undefined') {
            return [string, fret, fingerNumber];
          }
          return [string, fret]; // No finger number
        });
        
        const allFingers = [
          ...processedFingers,
          // Add open strings as [string, 0]
          ...(actualChartData.openStrings || []).map(string => [string, 0]),
          // Add muted strings as [string, 'x']
          ...(actualChartData.mutedStrings || []).map(string => [string, 'x'])
        ];

        // Prepare chord data
        const chordData = {
          fingers: allFingers,
          barres: actualChartData.barres || []
        };

        // Render the chart
        chartInstance.configure(config).chord(chordData).draw();

        // Style the SVG to fit the container
        setTimeout(() => {
          const svg = chartRef.current?.querySelector('svg');
          if (svg) {
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = '180px';
            svg.style.maxHeight = '192px';
            svg.style.position = 'relative';
            svg.style.zIndex = '1';
          }
        }, 50);
      } catch (error) {
        console.error('Error rendering memoized chord chart:', error);
      }
    };

    renderChart();
  }, [chart]); // Only re-render when chart data changes

  return (
    <div 
      className="bg-gray-800 p-1 rounded-lg relative" 
      style={{
        minWidth: '0',
        maxWidth: '100%',
        width: '100%',
        position: 'relative'
      }}
    >
      {/* Edit button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit(chart.id, chart);
        }}
        className="absolute bottom-1 left-1 w-6 h-6 text-blue-400 hover:text-blue-200 flex items-center justify-center text-sm transition-colors cursor-pointer z-20 bg-gray-900 bg-opacity-75 rounded shadow-lg"
        title="Edit chord chart"
        style={{
          position: 'absolute',
          bottom: '4px',
          left: '4px',
          zIndex: 20
        }}
      >
        ✏️
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(chart.id);
        }}
        className="absolute bottom-1 right-1 w-6 h-6 text-red-500 hover:text-red-700 flex items-center justify-center text-lg font-black transition-colors cursor-pointer z-20 bg-gray-900 bg-opacity-75 rounded shadow-lg"
        title="Delete chord chart"
        style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          zIndex: 20
        }}
      >
        ×
      </button>
      
      <div className="relative w-full h-48 mx-auto flex items-center justify-center overflow-hidden">
        <div 
          ref={chartRef}
          className="w-full h-full"
        >
          {/* SVGuitar chart will be rendered here */}
        </div>
      </div>
      <div className="text-sm font-semibold mt-2 text-center text-gray-300">{chart.title}</div>
    </div>
  );
});

export const PracticePage = () => {
  const { routine } = useActiveRoutine();
  const { fetchItemDetails, getItemDetails, isLoadingItem } = useItemDetails();
  const { items: allItems } = usePracticeItems();
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

  // Section management state
  const [chordSections, setChordSections] = useState({});
  const [deletingSection, setDeletingSection] = useState(new Set());
  const [editingChordId, setEditingChordId] = useState(null);
  
  // Chord chart copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceItemId, setCopySourceItemId] = useState(null);
  const [copySearchTerm, setCopySearchTerm] = useState('');
  const [selectedTargetItems, setSelectedTargetItems] = useState(new Set());

  // Helper function to group chords into sections based on persisted metadata
  const getChordSections = (itemId) => {
    const charts = chordCharts[itemId] || [];
    
    console.log(`[DEBUG] getChordSections for item ${itemId}:`, charts);
    
    if (charts.length === 0) {
      return [];
    }
    
    // Group chords by their section metadata
    const sectionMap = new Map();
    
    charts.forEach(chart => {
      const sectionId = chart.sectionId || 'section-1';
      const sectionLabel = chart.sectionLabel || 'Verse';
      const sectionRepeatCount = chart.sectionRepeatCount || '';
      
      console.log(`[DEBUG] Processing chord ${chart.id} (${chart.title}) for section ${sectionId}`, {
        chordSectionId: chart.sectionId, 
        chordSectionLabel: chart.sectionLabel,
        fallbackUsed: !chart.sectionId
      });
      
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, {
          id: sectionId,
          label: sectionLabel,
          repeatCount: sectionRepeatCount,
          chords: []
        });
      }
      
      sectionMap.get(sectionId).chords.push(chart);
    });
    
    // Convert map to array and sort by section creation order
    const sections = Array.from(sectionMap.values());
    
    
    return sections;
  };

  // Combined function to get both persisted and temporary sections

  // Function to add a new section
  const addNewSection = (itemId, label = 'New Section') => {
    console.log('Adding new section for item:', itemId, 'with label:', label);
    
    const newSection = {
      id: `section-${Date.now()}`,
      label,
      repeatCount: '',
      chords: []
    };
    
    setChordSections(prev => {
      const updated = {
        ...prev,
        [itemId]: [...(prev[itemId] || []), newSection]
      };
      console.log('Updated chordSections:', updated);
      return updated;
    });
  };


  // Debounced version of updateSection for real-time typing
  const debouncedUpdateSection = useCallback(
    debounce(async (itemId, sectionId, updates) => {
      console.log('Debounced section update:', sectionId, updates);
      
      try {
        // Fetch fresh chord charts from the backend to avoid stale state issues
        const response = await fetch(`/api/items/${itemId}/chord-charts`);
        if (!response.ok) {
          throw new Error(`Failed to fetch chord charts for item ${itemId}`);
        }
        const freshCharts = await response.json();
        
        console.log(`[DEBUG] Fresh charts for item ${itemId}:`, freshCharts.map(c => ({
          id: c.id, 
          title: c.title, 
          sectionId: c.sectionId || 'default-section'
        })));
        
        // Get all chord charts for this section that need to be updated
        const chartsToUpdate = freshCharts.filter(chart => 
          (chart.sectionId || 'section-1') === sectionId
        );
        
        if (chartsToUpdate.length === 0) {
          console.log(`No chord charts to update for section: ${sectionId}. This might be a new section without any chord charts yet.`);
          return;
        }
        
        console.log(`Updating ${chartsToUpdate.length} chord charts for section ${sectionId}:`, chartsToUpdate.map(c => c.id));
        
        // Update each chord chart in the backend
        const updatePromises = chartsToUpdate.map(chart => {
          const updateData = {};
          if (updates.label !== undefined) {
            updateData.sectionLabel = updates.label;
          }
          if (updates.repeatCount !== undefined) {
            updateData.sectionRepeatCount = updates.repeatCount;
          }
          
          console.log(`Updating chord chart ${chart.id} with:`, updateData);
          
          return fetch(`/api/chord-charts/${chart.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          }).then(response => {
            if (!response.ok) {
              throw new Error(`Failed to update chord chart ${chart.id}: ${response.status} ${response.statusText}`);
            }
            return response.json();
          });
        });
        
        await Promise.all(updatePromises);
        console.log(`Successfully persisted ${chartsToUpdate.length} chord charts for section ${sectionId}`);
        
      } catch (error) {
        console.error('Error persisting section updates:', error);
      }
    }, 500), // 500ms delay
    [] // Remove chordCharts dependency to avoid stale closures
  );

  // Fast local-only section update for immediate UI feedback
  const updateSectionLocal = (itemId, sectionId, updates) => {
    // Update the section in local state immediately
    setChordSections(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }));
    
    // Update chord charts in local state immediately
    setChordCharts(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map(chart => {
        if ((chart.sectionId || 'section-1') === sectionId) {
          return {
            ...chart,
            sectionLabel: updates.label !== undefined ? updates.label : chart.sectionLabel,
            sectionRepeatCount: updates.repeatCount !== undefined ? updates.repeatCount : chart.sectionRepeatCount
          };
        }
        return chart;
      })
    }));
    
    // Debounce the backend update
    debouncedUpdateSection(itemId, sectionId, updates);
  };

  const deleteSection = async (itemId, sectionId) => {
    // Prevent double-clicking/double-triggering
    const sectionKey = `${itemId}-${sectionId}`;
    if (deletingSection.has(sectionKey)) {
      console.log(`Delete already in progress for section ${sectionId}`);
      return;
    }
    
    setDeletingSection(prev => new Set([...prev, sectionKey]));
    
    try {
      // Get all chord charts in this section
      const chartsToDelete = (chordCharts[itemId] || []).filter(chart => 
        (chart.sectionId || 'section-1') === sectionId
      );
      
      if (chartsToDelete.length === 0) {
        console.log(`No chord charts to delete in section ${sectionId}`);
        // Just remove the empty section from local state
        setChordSections(prev => ({
          ...prev,
          [itemId]: (prev[itemId] || []).filter(section => section.id !== sectionId)
        }));
        return;
      }
      
      const chordIds = chartsToDelete.map(chart => chart.id);
      console.log(`Batch deleting ${chartsToDelete.length} chord charts from section ${sectionId}:`, chordIds);
      
      // Use batch delete endpoint
      const response = await fetch('/api/chord-charts/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chord_ids: chordIds })
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          console.warn('Rate limit exceeded, will retry after delay');
          // Show user-friendly message for rate limits
          alert(`Rate limit exceeded. Please wait a moment and try again. (${errorData.error})`);
          return;
        }
        throw new Error(`HTTP ${response.status}: Failed to batch delete chord charts`);
      }

      const result = await response.json();
      console.log('Batch delete result:', result);

      // Handle partial successes
      if (result.deleted && result.deleted.length > 0) {
        console.log(`Successfully deleted ${result.deleted.length} chord charts`);
      }
      
      if (result.not_found && result.not_found.length > 0) {
        console.warn(`${result.not_found.length} chord charts were already deleted:`, result.not_found);
      }
      
      if (result.failed && result.failed.length > 0) {
        console.error(`Failed to delete ${result.failed.length} chord charts:`, result.failed);
      }

      // Always update local state optimistically (backend handles partial failures)
      // Remove chord charts from local state
      setChordCharts(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || []).filter(chart => 
          (chart.sectionId || 'section-1') !== sectionId
        )
      }));
      
      // Remove section from local state
      setChordSections(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || []).filter(section => section.id !== sectionId)
      }));

      // Only throw if batch delete completely failed
      if (!result.success && result.failed && result.failed.length === chordIds.length) {
        throw new Error(result.error || 'All chord chart deletions failed');
      }
      
    } catch (error) {
      console.error('Error deleting section:', error);
      // TODO: Add user-visible error notification
    } finally {
      // Always clear the deleting state
      setDeletingSection(prev => {
        const next = new Set(prev);
        next.delete(sectionKey);
        return next;
      });
    }
  };



  // Lazy-load chord charts only when chord section is expanded
  const loadChordChartsForItem = async (itemReferenceId) => {
    // Skip if already loaded
    if (chordCharts[itemReferenceId]) {
      return;
    }
    
    try {
      const response = await fetch(`/api/items/${itemReferenceId}/chord-charts`);
      if (response.ok) {
        const charts = await response.json();
        
        // Update chord charts state
        setChordCharts(prev => ({
          ...prev,
          [itemReferenceId]: charts
        }));
        
        // Build sections from loaded chord charts
        if (charts.length === 0) {
          setChordSections(prev => ({
            ...prev,
            [itemReferenceId]: []
          }));
          return;
        }
        
        // Group chords by their section metadata
        const sectionMap = new Map();
        
        charts.forEach(chart => {
          const sectionId = chart.sectionId || 'section-1';
          const sectionLabel = chart.sectionLabel || 'Verse';
          const sectionRepeatCount = chart.sectionRepeatCount || '';
          
          if (!sectionMap.has(sectionId)) {
            sectionMap.set(sectionId, {
              id: sectionId,
              label: sectionLabel,
              repeatCount: sectionRepeatCount,
              chords: []
            });
          }
          
          sectionMap.get(sectionId).chords.push(chart);
        });
        
        // Update sections state
        setChordSections(prev => ({
          ...prev,
          [itemReferenceId]: Array.from(sectionMap.values())
        }));
        
        console.log('[DEBUG] Loaded chord charts for item:', itemReferenceId, charts.length);
      }
    } catch (error) {
      console.error('Error loading chord charts for item:', itemReferenceId, error);
    }
  };
  
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

  // Modified toggleItem to lazy-load item details when expanding
  const toggleItem = async (itemId) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        // Lazy-load item details when expanding
        const routineItem = routine.items.find(item => item['A'] === itemId);  // Column A is ID
        if (routineItem) {
          const itemReferenceId = routineItem['B'];  // Column B is Item ID
          
          // Fetch full item details if not already cached
          fetchItemDetails(itemReferenceId).then(itemDetails => {
            if (itemDetails) {
              // Initialize timer using fetched details
              initTimer(itemId, itemDetails['E'] || 5);  // Column E is Duration
              // Fetch notes when expanding
              fetchNotes(itemReferenceId);
            }
          });
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
        // Try to get cached item details, fallback to default
        const itemDetails = getItemDetails(routineItem['B']);
        const duration = itemDetails?.['E'] || 5;  // Column E is Duration
        initTimer(itemId, duration);
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
                // Lazy-load details for next item
                const nextItemReferenceId = nextItem['B'];
                fetchItemDetails(nextItemReferenceId).then(itemDetails => {
                  if (itemDetails) {
                    // Initialize timer and fetch notes for next item
                    initTimer(nextItem['A'], itemDetails['E'] || 5);
                    fetchNotes(nextItemReferenceId);
                  }
                });
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
      // Try to get cached item details, fallback to default
      const itemDetails = getItemDetails(routineItem['B']);
      const duration = itemDetails?.['E'] || 5;  // Column E is Duration
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

  const handleNoteSave = async () => {
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

  // Calculate total and completed minutes (simplified for now - may not be exact until items are loaded)
  const { totalMinutes, completedMinutes } = useMemo(() => {
    if (!routine?.items) return { totalMinutes: 0, completedMinutes: 0 };
    
    const total = routine.items.reduce((sum, item) => {
      // Try to get cached details, fallback to estimated default
      const itemDetails = getItemDetails(item['B']);
      const duration = parseInt(itemDetails?.['E']) || 5; // Default 5 minutes
      return sum + duration;
    }, 0);
    
    const completed = routine.items
      .filter(item => completedItems.has(item['A']))
      .reduce((sum, item) => {
        // Try to get cached details, fallback to estimated default
        const itemDetails = getItemDetails(item['B']);
        const duration = parseInt(itemDetails?.['E']) || 5; // Default 5 minutes
        return sum + duration;
      }, 0);
    
    return { totalMinutes: total, completedMinutes: completed };
  }, [routine, completedItems, getItemDetails]);

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
      // First, clean up any charts that are no longer needed
      Object.keys(chordChartRefs.current).forEach(refKey => {
        const [itemId, chartId] = refKey.split('-').slice(0, 2);
        
        // Check if this chart should still exist
        const shouldExist = expandedChords.has(itemId) && 
          chordCharts[itemId]?.some(chart => chart.id === chartId);
        
        if (!shouldExist) {
          // Clean up this chart
          const container = document.getElementById(`chord-chart-${refKey}`);
          if (container) {
            container.innerHTML = '';
          }
          delete chordChartRefs.current[refKey];
        }
      });
      
      // Now initialize new charts
      expandedChords.forEach(itemId => {
        // Get all charts for this item
        const itemCharts = chordCharts[itemId] || [];
        
        itemCharts.forEach(chartData => {
          const refKey = `${itemId}-${chartData.id}`;
          const container = document.getElementById(`chord-chart-${itemId}-${chartData.id}`);
          
          // Skip if container doesn't exist or chart already initialized
          if (!container || chordChartRefs.current[refKey]) {
            return;
          }

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
        // Lazy-load chord charts when chord section is expanded
        const routineItem = routine.items.find(item => item['A'] === itemId);
        if (routineItem) {
          const itemReferenceId = routineItem['B'];  // Column B is Item ID
          loadChordChartsForItem(itemReferenceId);
        }
      }
      return next;
    });
  };

  const handleSaveChordChart = async (itemId, chartData) => {
    try {
      serverInfo('Saving chord chart for item', { itemId, chartData });
      
      // Determine if we're creating or updating
      const isUpdate = chartData.editingChordId;
      let chartDataWithSection;
      
      // Initialize without line break updater by default
      chartDataWithSection = { ...chartData };
      
      if (isUpdate) {
        // For updates, preserve the original chord's section information
        const originalChord = (chordCharts[itemId] || []).find(chord => chord.id === chartData.editingChordId);
        
        // Add section metadata to existing chartDataWithSection
        chartDataWithSection.sectionId = originalChord?.sectionId;
        chartDataWithSection.sectionLabel = originalChord?.sectionLabel;
        chartDataWithSection.sectionRepeatCount = originalChord?.sectionRepeatCount;
        
        serverDebug('Updating chord, preserving section', {
          originalSection: {
            id: originalChord?.sectionId,
            label: originalChord?.sectionLabel,
            repeatCount: originalChord?.sectionRepeatCount
          }
        });
        
      } else {
        // For new chords, determine target section (use last section, or create default)
        const itemSections = chordSections[itemId] || getChordSections(itemId);
        let targetSection;
        
        
        if (itemSections.length === 0) {
          // No sections exist, create default
          targetSection = {
            id: 'section-1',
            label: 'Verse',
            repeatCount: ''
          };
        } else {
          // Use the last section
          targetSection = itemSections[itemSections.length - 1];
        }
        
        
        // Add section metadata to existing chartDataWithSection
        chartDataWithSection.sectionId = targetSection.id;
        chartDataWithSection.sectionLabel = targetSection.label;
        chartDataWithSection.sectionRepeatCount = targetSection.repeatCount;
        
      }
      
      // Handle line break before this chord (for both new and existing chords)
      if (chartData.startOnNewLine) {
        let targetChord, targetSection;
        
        if (isUpdate) {
          // For existing chords: find the chord that comes before the one being edited
          const allItemCharts = (chordCharts[itemId] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
          const editingChordIndex = allItemCharts.findIndex(chart => 
            parseInt(chart.id) === parseInt(chartData.editingChordId)
          );
          
          if (editingChordIndex > 0) {
            // Found a chord before the one being edited
            targetChord = allItemCharts[editingChordIndex - 1];
          } else {
            serverDebug('No chord before the editing chord, line break not needed');
          }
        } else {
          // For new chords: find the last chord in the target section (original behavior)
          targetSection = chartDataWithSection;
          const sectionCharts = (chordCharts[itemId] || []).filter(chart => 
            (chart.sectionId || 'section-1') === targetSection.sectionId
          );
          
          if (sectionCharts.length > 0) {
            const sortedCharts = sectionCharts.sort((a, b) => (a.order || 0) - (b.order || 0));
            targetChord = sortedCharts[sortedCharts.length - 1];
          } else {
            serverDebug('No previous chords in section, line break not needed');
          }
        }
        
        // Apply the line break if we found a target chord
        if (targetChord) {
          
          try {
            // Update the target chord to have a line break after it
            const lineBreakResponse = await fetch(`/api/chord-charts/${targetChord.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hasLineBreakAfter: true })
            });

            if (lineBreakResponse.ok) {
              const updatedTargetChord = await lineBreakResponse.json();
              
              // Create a function to update state with line break that can be reused
              const updateStateWithLineBreak = (currentCharts) => {
                return currentCharts.map(chart => {
                  const isTargetChart = parseInt(chart.id) === parseInt(targetChord.id);
                  serverDebug('Checking chart for line break update', {
                    chartId: chart.id,
                    chartIdInt: parseInt(chart.id),
                    targetId: targetChord.id,
                    targetIdInt: parseInt(targetChord.id),
                    isMatch: isTargetChart,
                    chartTitle: chart.title
                  });
                  
                  if (isTargetChart) {
                    serverDebug('Updating chart with line break', { 
                      originalChart: { id: chart.id, title: chart.title, hasLineBreakAfter: chart.hasLineBreakAfter },
                      updatedChart: { id: chart.id, title: chart.title, hasLineBreakAfter: true }
                    });
                    return { ...chart, hasLineBreakAfter: true };
                  }
                  return chart;
                });
              };

              // Update local state immediately
              setChordCharts(prev => {
                const updatedCharts = updateStateWithLineBreak(prev[itemId] || []);
                
                serverDebug('Final updated charts for line break', {
                  itemId,
                  originalCount: (prev[itemId] || []).length,
                  updatedCount: updatedCharts.length,
                  chartsWithLineBreak: updatedCharts.filter(c => c.hasLineBreakAfter).map(c => ({ id: c.id, title: c.title }))
                });
                
                return {
                  ...prev,
                  [itemId]: updatedCharts
                };
              });
              
              // Store the line break update function for later use
              chartDataWithSection._lineBreakUpdater = updateStateWithLineBreak;
            } else {
              serverInfo('Failed to add line break to target chord', { 
                status: lineBreakResponse.status,
                statusText: lineBreakResponse.statusText 
              });
            }
          } catch (error) {
            serverInfo('Error adding line break to target chord', { error: error.message });
          }
        }
      }
      
      serverDebug('Chord data with section metadata', { chartDataWithSection });
      
      const url = isUpdate 
        ? `/api/chord-charts/${chartData.editingChordId}`
        : `/api/items/${itemId}/chord-charts`;
      const method = isUpdate ? 'PUT' : 'POST';
      
      serverDebug(`${isUpdate ? 'Updating' : 'Creating'} chord chart`, { method, url });
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chartDataWithSection)
      });

      if (!response.ok) {
        throw new Error(`Failed to save chord chart: ${response.statusText}`);
      }

      const savedChart = await response.json();
      serverInfo('Chord chart saved successfully', { savedChart });
      
      // DEBUG: Detailed logging of saved chord data format
      console.log('DEBUG: Saved chord detailed breakdown:', {
        id: savedChart.id,
        title: savedChart.title,
        fingers: savedChart.fingers,
        fingersType: typeof savedChart.fingers,
        fingersLength: savedChart.fingers?.length,
        barres: savedChart.barres,
        barresType: typeof savedChart.barres,
        tuning: savedChart.tuning,
        startingFret: savedChart.startingFret,
        numFrets: savedChart.numFrets,
        numStrings: savedChart.numStrings,
        openStrings: savedChart.openStrings,
        mutedStrings: savedChart.mutedStrings
      });

      // Update local state with the saved chart
      setChordCharts(prev => {
        const itemCharts = prev[itemId] || [];
        
        if (isUpdate) {
          // Update existing chord - ensure consistent type comparison
          const editingId = parseInt(chartData.editingChordId);
          serverDebug('Updating chordCharts state', { 
            editingId, 
            editingChordIdOriginal: chartData.editingChordId,
            existingChartIds: itemCharts.map(c => ({ id: c.id, type: typeof c.id }))
          });
          
          let updatedCharts = itemCharts.map(chart => {
            const match = parseInt(chart.id) === editingId;
            if (match) {
              serverDebug('Found matching chord to update', { chart: chart.id, editingId });
              console.log('DEBUG: State update - replacing old chart:', {
                oldChart: chart,
                newChart: savedChart,
                fingersOld: chart.fingers,
                fingersNew: savedChart.fingers
              });
            }
            return match ? savedChart : chart;
          });
          
          // Apply line break updater if it exists (for line break before edited chord)
          if (chartDataWithSection._lineBreakUpdater) {
            serverDebug('Applying stored line break updater to preserve line breaks');
            updatedCharts = chartDataWithSection._lineBreakUpdater(updatedCharts);
          }
          
          serverDebug('Updated charts result', { 
            originalCount: itemCharts.length, 
            updatedCount: updatedCharts.length,
            foundMatch: updatedCharts.some(c => parseInt(c.id) === editingId),
            hasLineBreakUpdater: !!chartDataWithSection._lineBreakUpdater
          });
          
          return {
            ...prev,
            [itemId]: updatedCharts
          };
        } else {
          // Add new chord
          let finalCharts = [...itemCharts, savedChart];
          
          // Apply line break updater if it exists (for line break before new chord)  
          if (chartDataWithSection._lineBreakUpdater) {
            serverDebug('Applying stored line break updater to preserve line breaks for new chord');
            finalCharts = chartDataWithSection._lineBreakUpdater(finalCharts);
          }
          
          return {
            ...prev,
            [itemId]: finalCharts
          };
        }
      });

      // Update sections state
      setChordSections(prev => {
        const itemSections = prev[itemId] || [];
        
        if (isUpdate) {
          // Update existing chord in sections - ensure consistent type comparison
          const editingId = parseInt(chartData.editingChordId);
          serverDebug('Updating chordSections state', { 
            editingId,
            sectionsCount: itemSections.length
          });
          
          let updatedSections = itemSections.map(section => {
            const updatedChords = section.chords.map(chord => {
              const match = parseInt(chord.id) === editingId;
              if (match) {
                serverDebug('Found matching chord in section', { 
                  sectionId: section.id, 
                  sectionLabel: section.label,
                  chordId: chord.id,
                  editingId 
                });
              }
              return match ? savedChart : chord;
            });
            
            return {
              ...section,
              chords: updatedChords
            };
          });
          
          // Apply line break updater to sections as well if it exists
          if (chartDataWithSection._lineBreakUpdater) {
            serverDebug('Applying line break updater to sections state');
            updatedSections = updatedSections.map(section => ({
              ...section,
              chords: chartDataWithSection._lineBreakUpdater(section.chords)
            }));
          }
          
          return {
            ...prev,
            [itemId]: updatedSections
          };
        } else {
          // Add new chord to section
          // If no sections exist, create a default one
          if (itemSections.length === 0) {
            const newSections = [{
              id: 'section-1',
              label: 'Verse',
              repeatCount: '',
              chords: [savedChart]
            }];
            
            // Apply line break updater if it exists
            if (chartDataWithSection._lineBreakUpdater) {
              serverDebug('Applying line break updater to new section');
              newSections[0].chords = chartDataWithSection._lineBreakUpdater(newSections[0].chords);
            }
            
            return {
              ...prev,
              [itemId]: newSections
            };
          }
          
          // Add to the last section
          const updatedSections = [...itemSections];
          const lastSection = { ...updatedSections[updatedSections.length - 1] };
          lastSection.chords = [...lastSection.chords, savedChart];
          
          // Apply line break updater if it exists
          if (chartDataWithSection._lineBreakUpdater) {
            serverDebug('Applying line break updater to updated section');
            lastSection.chords = chartDataWithSection._lineBreakUpdater(lastSection.chords);
          }
          
          updatedSections[updatedSections.length - 1] = lastSection;
          
          return {
            ...prev,
            [itemId]: updatedSections
          };
        }
      });

      // With memoized components, updates will automatically trigger re-renders

      // Hide the editor after saving and clear editing state
      setShowChordEditor(prev => ({
        ...prev,
        [itemId]: false
      }));
      setEditingChordId(null);

    } catch (error) {
      console.error('Error saving chord chart:', error);
      // TODO: Add user-visible error handling
    }
  };

  const handleDeleteChordChart = async (itemId, chordId) => {
    try {
      console.log('Deleting chord chart:', chordId, 'for item:', itemId);
      
      const response = await fetch(`/api/chord-charts/${chordId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          console.warn('Rate limit exceeded for individual delete');
          alert(`Rate limit exceeded. Please wait a moment and try again. (${errorData.error})`);
          return;
        }
        throw new Error(`Failed to delete chord chart: ${response.statusText}`);
      }

      console.log('Chord chart deleted successfully');

      // Update local state by removing the chart
      setChordCharts(prev => {
        const itemCharts = prev[itemId] || [];
        return {
          ...prev,
          [itemId]: itemCharts.filter(chart => chart.id !== chordId)
        };
      });

      // Also remove from sections
      setChordSections(prev => {
        const itemSections = prev[itemId] || [];
        const updatedSections = itemSections.map(section => ({
          ...section,
          chords: section.chords.filter(chart => chart.id !== chordId)
        }));
        
        return {
          ...prev,
          [itemId]: updatedSections
        };
      });

    } catch (error) {
      console.error('Error deleting chord chart:', error);
      // TODO: Add user-visible error handling
    }
  };

  const handleEditChordChart = (itemId, chordId, chartData) => {
    console.log('Edit chord chart:', chordId, 'for item:', itemId, 'with data:', chartData);
    
    // Show the chord editor for this item
    setShowChordEditor(prev => ({
      ...prev,
      [itemId]: true
    }));
    
    // Set the editing chord ID in the editor so it knows to update instead of create
    // We'll need to pass this to the ChordChartEditor component
    setEditingChordId(chordId);
  };

  // Chord chart copy functionality
  const handleOpenCopyModal = (itemId) => {
    setCopySourceItemId(itemId);
    setShowCopyModal(true);
    setCopySearchTerm('');
    setSelectedTargetItems(new Set());
  };

  const handleCloseCopyModal = () => {
    setShowCopyModal(false);
    setCopySourceItemId(null);
    setCopySearchTerm('');
    setSelectedTargetItems(new Set());
  };

  const handleToggleTargetItem = (itemId) => {
    setSelectedTargetItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleConfirmCopy = async () => {
    if (!copySourceItemId || selectedTargetItems.size === 0) {
      return;
    }

    try {
      const response = await fetch('/api/chord-charts/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_item_id: copySourceItemId,
          target_item_ids: Array.from(selectedTargetItems)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to copy chord charts: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Chord charts copied successfully:', result);

      // Refresh chord charts for all affected items
      const affectedItems = [copySourceItemId, ...Array.from(selectedTargetItems)];
      for (const itemId of affectedItems) {
        if (chordCharts[itemId]) {
          await loadChordChartsForItem(itemId);
        }
      }

      handleCloseCopyModal();
    } catch (error) {
      console.error('Error copying chord charts:', error);
      // TODO: Add user-visible error handling
    }
  };

  const toggleChordEditor = (itemId, e) => {
    e?.stopPropagation();
    setShowChordEditor(prev => {
      // Clear editing state when closing the editor
      if (prev[itemId]) {
        setEditingChordId(null);
      }
      
      return {
        ...prev,
        [itemId]: !prev[itemId]
      };
    });
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
          
          // Get full item details from cache if available, otherwise use defaults
          const itemDetails = getItemDetails(routineItem['B']);
          const timerValue = timers[routineItem['A']] !== undefined 
            ? timers[routineItem['A']] 
            : (itemDetails?.['E'] || 5) * 60;  // Column E is Duration
          const itemNotes = notes[routineItem['B']] || '';
          const isChordsExpanded = expandedChords.has(routineItem['A']);
          
          // For collapsed items, use minimal details; for expanded items, use full details or loading state
          const displayTitle = routineItem.minimalDetails?.['C'] || 'Loading...';
          const isLoadingDetails = isExpanded && !itemDetails && isLoadingItem(routineItem['B']);
          
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
                    {displayTitle}
                    {isLoadingDetails && <span className="text-gray-500 ml-2">(Loading details...)</span>}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  {(itemDetails?.['E'] || isExpanded) && (  // Show timer if duration available or item is expanded
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
                      {!isTimerActive && timerValue !== (itemDetails?.['E'] || 5) * 60 && (  // Column E is Duration
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
                        {/* Display chord sections */}
                        {(() => {
                          // Define itemReferenceId at the top level of this scope
                          const itemReferenceId = routineItem['B'];  // Column B is Item ID
                          const sectionsFromState = chordSections[itemReferenceId];
                          const sectionsFromCharts = sectionsFromState ? null : getChordSections(itemReferenceId);
                          const finalSections = sectionsFromState || sectionsFromCharts || [];
                          
                          // Map sections to JSX elements with itemReferenceId in scope
                          const sections = finalSections.map((section, sectionIndex) => {
                            return (
                          <div key={section.id} className="mb-6">
                            {/* Section header with label and repeat count */}
                            <div className="flex justify-between items-center mb-3">
                              {/* Section label (top-left) */}
                              <input
                                type="text"
                                value={section.label}
                                onChange={(e) => {
                                  console.log('Updating section label:', section.id, e.target.value);
                                  updateSectionLocal(itemReferenceId, section.id, { label: e.target.value });
                                }}
                                className="bg-gray-900 text-white px-2 py-1 rounded text-sm font-semibold border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Section name"
                              />
                              
                              {/* Repeat count, line break, and section delete */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={section.repeatCount}
                                  onChange={(e) => updateSectionLocal(itemReferenceId, section.id, { repeatCount: e.target.value })}
                                  className="bg-gray-900 text-white px-2 py-1 rounded text-sm w-6 text-center border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="x2"
                                  maxLength="3"
                                />
                                <button
                                  onClick={() => deleteSection(itemReferenceId, section.id)}
                                  className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                                  title="Delete section"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Tuning and capo info - only show on first section */}
                            {sectionIndex === 0 && (() => {
                              // Get tuning and capo from first chord in section (they should all be the same)
                              const firstChord = section.chords[0];
                              if (!firstChord) return null;
                              
                              const tuning = firstChord.tuning || 'EADGBE';
                              const capo = firstChord.capo || 0;
                              
                              return (
                                <div className="text-center text-white font-bold text-sm mb-3">
                                  {capo > 0 ? `${tuning} | Capo on ${capo}` : tuning}
                                </div>
                              );
                            })()}

                            {/* Chord grid for this section */}
                            {section.chords.length > 0 && (
                              <div className="space-y-2">
                                {(() => {
                                  // Group chords by line breaks
                                  const chordRows = [];
                                  let currentRow = [];
                                  
                                  section.chords.forEach((chart, index) => {
                                    currentRow.push(chart);
                                    
                                    // Start new row if:
                                    // 1. This chord has a line break after it
                                    // 2. We've reached 5 chords (original behavior)
                                    // 3. This is the last chord
                                    if (chart.hasLineBreakAfter || currentRow.length >= 5 || index === section.chords.length - 1) {
                                      chordRows.push([...currentRow]);
                                      currentRow = [];
                                    }
                                  });
                                  
                                  return chordRows.map((row, rowIndex) => (
                                    <div 
                                      key={rowIndex}
                                      className="grid grid-cols-5 gap-2" 
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(5, 1fr)',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      {row.map(chart => (
                                        <MemoizedChordChart
                                          key={chart.id}
                                          chart={chart}
                                          onEdit={(chordId, chartData) => handleEditChordChart(itemReferenceId, chordId, chartData)}
                                          onDelete={(chordId) => handleDeleteChordChart(itemReferenceId, chordId)}
                                        />
                                      ))}
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                          );
                          });

                          // Return the complete chord chart content including buttons and editor
                          return (
                            <>
                              {sections}
                              
                              {/* Add new section button */}
                              {/* Toggle for chord editor */}
                              <Button
                                variant="outline"
                                onClick={(e) => toggleChordEditor(itemReferenceId, e)}
                                className="w-full mb-4"
                              >
                                {showChordEditor[itemReferenceId] ? 'Hide Chord Editor' : 'Add New Chord'}
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() => addNewSection(itemReferenceId)}
                                className="w-full mb-4 border-gray-600"
                              >
                                + Add New Section
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() => handleOpenCopyModal(itemReferenceId)}
                                className="w-full mb-4 border-purple-600 text-purple-300 hover:bg-purple-800"
                              >
                                Copy chord charts to other song
                              </Button>

                              {/* Chord editor */}
                              {showChordEditor[itemReferenceId] && (
                                <ChordChartEditor
                                  itemId={itemReferenceId}
                                  defaultTuning={itemDetails?.H || 'EADGBE'}
                                  editingChordId={editingChordId}
                                  onSave={(chartData) => handleSaveChordChart(itemReferenceId, chartData)}
                                  onCancel={() => {
                                    setShowChordEditor(prev => ({ ...prev, [itemReferenceId]: false }));
                                    setEditingChordId(null);
                                  }}
                                />
                              )}
                            </>
                          );
                        })()}
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
                        {itemDetails?.['F'] && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch('/api/open-folder', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ path: itemDetails['F'] })
                              }).catch(err => console.error('Error opening folder:', err));
                            }}
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center"
                          >
                            <Book className="h-4 w-4 mr-2" />
                            Open Songbook Folder
                          </button>
                        )}
                        {/* Tuning */}
                        {itemDetails?.['H'] && (
                          <span className="text-sm font-mono font-bold text-gray-400">
                            {itemDetails['H']}
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

      {/* Copy Chord Charts Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4">
              Copy Chord Charts
            </h2>
            
            <p className="text-gray-300 mb-4">
              Copy chord charts from "{getItemDetails(copySourceItemId)?.['C'] || 'Unknown Song'}" to:
            </p>

            {/* Search field */}
            <input
              type="text"
              placeholder="Search songs..."
              value={copySearchTerm}
              onChange={(e) => setCopySearchTerm(e.target.value)}
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500"
            />

            {/* Scrollable song list */}
            <div className="max-h-60 overflow-y-auto mb-4">
              {allItems
                .filter(item => {
                  // Filter out the source item
                  if (item['A'] === copySourceItemId) return false;
                  
                  // Filter out items that already share chord charts with source
                  const itemHasSharedCharts = (chordCharts[copySourceItemId] || []).some(chart => {
                    const itemIds = chart.itemId ? chart.itemId.toString().split(',').map(id => id.trim()) : [];
                    return itemIds.includes(item['A'].toString());
                  });
                  if (itemHasSharedCharts) return false;
                  
                  // Filter by search term
                  if (copySearchTerm) {
                    const title = item['C'] || '';
                    return title.toLowerCase().includes(copySearchTerm.toLowerCase());
                  }
                  
                  return true;
                })
                .map(item => (
                  <div key={item['A']} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={`copy-item-${item['A']}`}
                      checked={selectedTargetItems.has(item['A'])}
                      onChange={() => handleToggleTargetItem(item['A'])}
                      className="mr-3"
                    />
                    <label 
                      htmlFor={`copy-item-${item['A']}`}
                      className="text-white cursor-pointer flex-1"
                    >
                      {item['C'] || 'Untitled'}
                    </label>
                  </div>
                ))}
            </div>

            {/* Modal buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCloseCopyModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCopy}
                disabled={selectedTargetItems.size === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
              >
                Copy to {selectedTargetItems.size} song{selectedTargetItems.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 