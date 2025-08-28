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
import { ChevronDown, ChevronRight, Check, Plus, FileText, Book, Music, Upload, AlertTriangle, X, Wand, Sparkles } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { ChordChartEditor } from './ChordChartEditor';
import ApiErrorModal from './ApiErrorModal';
import { serverDebug, serverInfo } from '../utils/logging';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
const MemoizedChordChart = memo(({ chart, onEdit, onDelete, onInsertAfter }) => {
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

      {/* Insert after button */}
      {onInsertAfter && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInsertAfter(chart.id, chart);
          }}
          className="absolute bottom-1 right-8 w-6 h-6 bg-blue-500 hover:bg-blue-400 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors cursor-pointer z-20 shadow-lg"
          title="Insert chord after this one"
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '32px',
            zIndex: 20
          }}
        >
          +
        </button>
      )}
      
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
  const [chordCharts, setChordCharts] = useState({});
  const [showChordEditor, setShowChordEditor] = useState({});

  // Section management state
  const [chordSections, setChordSections] = useState({});
  const [deletingSection, setDeletingSection] = useState(new Set());
  const [editingChordId, setEditingChordId] = useState(null);
  const [insertionContext, setInsertionContext] = useState(null);
  
  // Chord chart copy modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceItemId, setCopySourceItemId] = useState(null);
  const [copySearchTerm, setCopySearchTerm] = useState('');
  const [selectedTargetItems, setSelectedTargetItems] = useState(new Set());
  
  // Autocreate chord charts from files
  const [showDeleteChordsModal, setShowDeleteChordsModal] = useState(false);
  const [deleteModalItemId, setDeleteModalItemId] = useState(null);
  const [autocreateProgress, setAutocreateProgress] = useState({});
  const [isDragActive, setIsDragActive] = useState({});
  const [showAutocreateZone, setShowAutocreateZone] = useState({});
  const [autocreateAbortController, setAutocreateAbortController] = useState({});
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
  
  // Single file tracking for all uploaded files
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [showMixedContentModal, setShowMixedContentModal] = useState(false);
  const [mixedContentData, setMixedContentData] = useState(null);
  const [showUnsupportedFormatModal, setShowUnsupportedFormatModal] = useState(false);
  const [unsupportedFormatData, setUnsupportedFormatData] = useState(null);
  
  // API Error modal state
  const [showApiErrorModal, setShowApiErrorModal] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  // Rotating processing messages for entertainment
  const processingMessages = [
    "✨ Claude is making magic happen",
    "Yeah, we all love instant gratification, but some things are worth waiting for",
    "Good things come to those who wait",
    "Chill. Patience is a virtue",
    "You could be stretching or something while you wait, couldn't you?",
    "Rome wasn't built in a day... neither are chord charts",
    "Perfect chord charts take time to craft"
  ];

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

  // Helper function to build sections from charts array (used after autocreate)
  const buildSectionsFromCharts = (charts) => {
    if (charts.length === 0) {
      return [];
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
    
    // Convert to array and sort sections by the order of their first chord
    const sections = Array.from(sectionMap.values()).sort((a, b) => {
      const aMinOrder = Math.min(...a.chords.map(c => c.order || 0));
      const bMinOrder = Math.min(...b.chords.map(c => c.order || 0));
      return aMinOrder - bMinOrder;
    });
    
    // Sort chords within each section by order
    sections.forEach(section => {
      section.chords.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    
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
  // Batch load chord charts for all items in the routine
  const loadAllChordCharts = useCallback(async () => {
    if (!routine || !routine.items) return;
    
    // Get all item IDs that need chord charts loaded
    const itemIds = routine.items
      .map(item => item['B']) // Column B is Item ID
      .filter(itemId => !chordCharts[itemId]); // Only load if not already loaded
    
    if (itemIds.length === 0) return;
    
    try {
      const response = await fetch('/api/chord-charts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds })
      });
      
      if (response.ok) {
        const batchResults = await response.json();
        
        // Update chord charts state with all results
        setChordCharts(prev => ({
          ...prev,
          ...batchResults
        }));
        
        // Build sections for each item using existing getChordSections logic
        Object.entries(batchResults).forEach(([itemId, charts]) => {
          if (charts.length === 0) {
            setChordSections(prev => ({
              ...prev,
              [itemId]: []
            }));
          } else {
            // Group chords by their section metadata (same logic as getChordSections)
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
            
            const sections = Array.from(sectionMap.values());
            setChordSections(prev => ({
              ...prev,
              [itemId]: sections
            }));
          }
        });
      }
    } catch (error) {
      console.error('Error batch loading chord charts:', error);
    }
  }, [routine, chordCharts]);
  
  // Batch load chord charts when routine changes
  useEffect(() => {
    if (routine && routine.items) {
      loadAllChordCharts();
    }
  }, [routine, loadAllChordCharts]);
  
  // Rotate processing messages every 10 seconds
  useEffect(() => {
    const processingItems = Object.values(autocreateProgress).filter(progress => progress === 'processing');
    
    if (processingItems.length === 0) {
      // Reset message index when no processing
      setProcessingMessageIndex(0);
      return;
    }
    
    const interval = setInterval(() => {
      setProcessingMessageIndex(prev => (prev + 1) % processingMessages.length);
    }, 10000); // 10 seconds
    
    return () => clearInterval(interval);
  }, [autocreateProgress, processingMessages.length]);
  
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

  // Effect to load SVGuitar library for MemoizedChordChart components
  useEffect(() => {
    // Load SVGuitar UMD script if not already loaded
    if (!window.svguitar) {
      const script = document.createElement('script');
      script.src = 'https://omnibrain.github.io/svguitar/js/svguitar.umd.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

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
        // For new chords, determine target section
        const itemSections = chordSections[itemId] || getChordSections(itemId);
        let targetSection;
        
        // Check if we have insertion context (inserting after specific chord)
        if (chartData.insertionContext) {
          // Use section from insertion context
          targetSection = {
            id: chartData.insertionContext.sectionId,
            label: chartData.insertionContext.sectionLabel,
            repeatCount: chartData.insertionContext.sectionRepeatCount
          };
        } else if (itemSections.length === 0) {
          // No sections exist, create default
          targetSection = {
            id: 'section-1',
            label: 'Verse',
            repeatCount: ''
          };
        } else {
          // Use the last section (original behavior for "Add New Chord")
          targetSection = itemSections[itemSections.length - 1];
        }
        
        
        // Add section metadata to existing chartDataWithSection
        chartDataWithSection.sectionId = targetSection.id;
        chartDataWithSection.sectionLabel = targetSection.label;
        chartDataWithSection.sectionRepeatCount = targetSection.repeatCount;
        
      }
      
      // Handle line break after this chord - always set the value explicitly
      chartDataWithSection.hasLineBreakAfter = chartData.startOnNewLine || false;
      serverDebug('Setting line break after chord', { 
        title: chartDataWithSection.title,
        hasLineBreakAfter: chartDataWithSection.hasLineBreakAfter 
      });
      
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
          
          // Add to appropriate section with proper insertion logic
          const updatedSections = [...itemSections];
          
          if (chartData.insertionContext) {
            // Insert at specific position within target section
            const targetSectionIndex = updatedSections.findIndex(section => 
              section.id === chartData.insertionContext.sectionId
            );
            
            if (targetSectionIndex >= 0) {
              const targetSection = { ...updatedSections[targetSectionIndex] };
              const insertOrder = chartData.insertionContext.insertOrder;
              
              // Find insertion point and insert chord
              const insertionIndex = targetSection.chords.findIndex(chord => 
                parseInt(chord.order) >= insertOrder
              );
              
              if (insertionIndex >= 0) {
                // Insert in the middle of the section
                targetSection.chords = [
                  ...targetSection.chords.slice(0, insertionIndex),
                  savedChart,
                  ...targetSection.chords.slice(insertionIndex)
                ];
              } else {
                // Insert at the end of the section
                targetSection.chords = [...targetSection.chords, savedChart];
              }
              
              updatedSections[targetSectionIndex] = targetSection;
            } else {
              // Target section not found, add to last section as fallback
              const lastSection = { ...updatedSections[updatedSections.length - 1] };
              lastSection.chords = [...lastSection.chords, savedChart];
              updatedSections[updatedSections.length - 1] = lastSection;
            }
          } else {
            // Original behavior: add to the last section
            const lastSection = { ...updatedSections[updatedSections.length - 1] };
            lastSection.chords = [...lastSection.chords, savedChart];
            updatedSections[updatedSections.length - 1] = lastSection;
          }
          
          // Apply line break updater if it exists
          if (chartDataWithSection._lineBreakUpdater) {
            serverDebug('Applying line break updater to updated sections');
            updatedSections.forEach(section => {
              section.chords = chartDataWithSection._lineBreakUpdater(section.chords);
            });
          }
          
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
      setInsertionContext(null);

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

  const handleInsertChordAfter = (itemId, afterChordId, afterChartData) => {
    console.log('Insert chord after:', afterChordId, 'for item:', itemId, 'with data:', afterChartData);
    
    // Show the chord editor for this item
    setShowChordEditor(prev => ({
      ...prev,
      [itemId]: true
    }));
    
    // Set insertion context - we'll pass this to the ChordChartEditor
    // insertOrder should be the position to insert at, not after
    setInsertionContext({
      afterChordId,
      sectionId: afterChartData.sectionId,
      sectionLabel: afterChartData.sectionLabel,
      sectionRepeatCount: afterChartData.sectionRepeatCount,
      insertOrder: parseInt(afterChartData.order) + 1
    });
    
    // Clear editing chord ID since this is a new chord
    setEditingChordId(null);
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

  // Autocreate functions
  const handleAutocreateClick = (itemId) => {
    const existingCharts = chordCharts[itemId] || [];
    if (existingCharts.length > 0) {
      // Show modal asking to delete existing charts
      setDeleteModalItemId(itemId);
      setShowDeleteChordsModal(true);
    } else {
      // No existing charts, proceed with file selection
      // This will be handled by the drag-and-drop zone
    }
  };

  const handleDeleteExistingCharts = async () => {
    if (!deleteModalItemId) return;
    
    try {
      // Delete all chord charts for this item
      const existingCharts = chordCharts[deleteModalItemId] || [];
      for (const chart of existingCharts) {
        const response = await fetch(`/api/chord-charts/${chart.id}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          throw new Error(`Failed to delete chord chart ${chart.id}`);
        }
      }
      
      // Force refresh chord charts (clear state first since all charts are deleted)
      setChordCharts(prev => ({
        ...prev,
        [deleteModalItemId]: []
      }));
      setChordSections(prev => ({
        ...prev,
        [deleteModalItemId]: []
      }));
      
      // Close modal
      setShowDeleteChordsModal(false);
      setDeleteModalItemId(null);
    } catch (error) {
      console.error('Error deleting existing chord charts:', error);
    }
  };

  const handleCancelAutocreate = (itemId) => {
    // Cancel the request if it's in progress
    if (autocreateAbortController[itemId]) {
      autocreateAbortController[itemId].abort();
    }
    
    // Reset all state for this item
    setAutocreateProgress(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
    setAutocreateAbortController(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
    setUploadedFiles(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

  const handleSingleFileDrop = (itemId, files) => {
    if (!files || files.length === 0) return;
    
    // Validate file count
    if (files.length > 5) {
      alert('Maximum 5 files allowed. Please select fewer files.');
      return;
    }
    
    setUploadedFiles(prev => ({ ...prev, [itemId]: Array.from(files) }));
  };
  
  const handleProcessFiles = async (itemId) => {
    const files = uploadedFiles[itemId] || [];
    
    if (files.length === 0) {
      alert('Please add at least one file before processing.');
      return;
    }
    
    await handleFileDrop(itemId, files);
  };

  const handleMixedContentChoice = async (contentType) => {
    if (!mixedContentData) return;
    
    const { itemId, files } = mixedContentData;
    
    try {
      setAutocreateProgress({ [itemId]: 'processing' });
      setShowMixedContentModal(false);
      
      // Create FormData and add user choice
      const formData = new FormData();
      files.forEach((file, index) => {
        // We need to reconstruct the file from the base64 data
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const reconstructedFile = new File([byteArray], file.name, { type: file.media_type });
        formData.append(`file${index}`, reconstructedFile);
      });
      formData.append('itemId', itemId);
      formData.append('userChoice', contentType); // Add user's choice
      
      const response = await fetch('/api/autocreate-chord-charts', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process files');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setAutocreateProgress({ [itemId]: 'complete' });
        
        // Force refresh chord charts
        try {
          const chartsResponse = await fetch(`/api/items/${itemId}/chord-charts`);
          if (chartsResponse.ok) {
            const charts = await chartsResponse.json();
            setChordCharts(prev => ({ ...prev, [itemId]: charts }));
            
            if (charts && charts.length > 0) {
              const sections = buildSectionsFromCharts(charts);
              setChordSections(prev => ({ ...prev, [itemId]: sections }));
            }
          }
        } catch (error) {
          console.error('Failed to refresh chord charts after mixed content choice:', error);
        }
        
        // Clear state after delay
        setTimeout(() => {
          setAutocreateProgress(prev => {
            const newState = { ...prev };
            delete newState[itemId];
            return newState;
          });
          setUploadedFiles(prev => {
            const newState = { ...prev };
            delete newState[itemId];
            return newState;
          });
          setMixedContentData(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing mixed content choice:', error);
      setAutocreateProgress({ [itemId]: 'error' });
      setMixedContentData(null);
    }
  };
  
  const handleFileDrop = async (itemId, files) => {
    if (!files || files.length === 0) return;
    
    // Validate file count
    if (files.length > 5) {
      alert('Maximum 5 files allowed. Please select fewer files.');
      return;
    }
    
    try {
      setAutocreateProgress({ [itemId]: 'uploading' });
      
      // Create abort controller for this request
      const abortController = new AbortController();
      setAutocreateAbortController(prev => ({ ...prev, [itemId]: abortController }));
      
      const formData = new FormData();
      Array.from(files).forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      formData.append('itemId', itemId);
      
      // Show uploading for minimum 2 seconds, then switch to processing
      const minDisplayTime = 2000;
      
      setTimeout(() => {
        setAutocreateProgress({ [itemId]: 'processing' });
      }, minDisplayTime);
      
      const response = await fetch('/api/autocreate-chord-charts', {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process files');
      }
      
      const result = await response.json();
      
      // Check if user needs to choose between mixed content types
      if (result.needs_user_choice) {
        setMixedContentData({
          itemId: itemId,
          options: result.mixed_content_options || [],
          files: result.files || []
        });
        setShowMixedContentModal(true);
        setAutocreateProgress(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
        return;
      }

      // Check for unsupported file formats
      if (result.error === 'unsupported_format') {
        setUnsupportedFormatData({
          message: result.message,
          title: result.title
        });
        setShowUnsupportedFormatModal(true);
        setAutocreateProgress(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
        return;
      }
      
      setAutocreateProgress({ [itemId]: 'complete' });
      
      // Force refresh chord charts for this item (don't use loadChordChartsForItem as it skips if already loaded)
      try {
        const response = await fetch(`/api/items/${itemId}/chord-charts`);
        if (response.ok) {
          const charts = await response.json();
          
          // Update chord charts state like manual creation does
          setChordCharts(prev => ({
            ...prev,
            [itemId]: charts
          }));
          
          // Build sections from loaded chord charts
          if (charts.length === 0) {
            setChordSections(prev => ({
              ...prev,
              [itemId]: []
            }));
          } else {
            // Group chords by their section metadata (same logic as getChordSections)
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
            
            // Convert to array and sort sections by the order of their first chord
            const sections = Array.from(sectionMap.values()).sort((a, b) => {
              const aMinOrder = Math.min(...a.chords.map(c => c.order || 0));
              const bMinOrder = Math.min(...b.chords.map(c => c.order || 0));
              return aMinOrder - bMinOrder;
            });
            
            // Sort chords within each section by order
            sections.forEach(section => {
              section.chords.sort((a, b) => (a.order || 0) - (b.order || 0));
            });
            
            setChordSections(prev => ({
              ...prev,
              [itemId]: sections
            }));
          }
        }
      } catch (error) {
        console.error('Failed to refresh chord charts after autocreate:', error);
      }
      
      // Clear progress and close autocreate zone after a delay
      setTimeout(() => {
        setAutocreateProgress(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
        setShowAutocreateZone(prev => ({ ...prev, [itemId]: false }));
        setAutocreateAbortController(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
        setUploadedFiles(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
      }, 5000);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Autocreate request was cancelled');
        return;
      }
      
      console.error('Error in autocreate:', error);
      
      // Check if this is an API error that needs special handling
      const errorMsg = error.message || error.toString();
      if (errorMsg.includes('529') || errorMsg.includes('overloaded') || 
          errorMsg.includes('429') || errorMsg.includes('rate limit') ||
          errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') ||
          errorMsg.includes('timeout')) {
        // Show API error modal for these specific errors
        setApiError(error);
        setShowApiErrorModal(true);
        setAutocreateProgress({ [itemId]: 'idle' }); // Reset to idle state
      } else {
        // Generic error handling for other errors
        setAutocreateProgress({ [itemId]: 'error' });
      }
      
      // Clear error state after delay (only for generic errors)
      if (!(errorMsg.includes('529') || errorMsg.includes('overloaded') || 
            errorMsg.includes('429') || errorMsg.includes('rate limit') ||
            errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') ||
            errorMsg.includes('timeout'))) {
        setTimeout(() => {
          setAutocreateProgress(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
        setAutocreateAbortController(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
      }, 5000);
      }
    }
  };


  const toggleChordEditor = (itemId, e) => {
    e?.stopPropagation();
    setShowChordEditor(prev => {
      // Clear editing state when closing the editor
      if (prev[itemId]) {
        setEditingChordId(null);
        setInsertionContext(null);
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
                                    // 2. We've reached 5 chords
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
                                          onInsertAfter={(chordId, chartData) => handleInsertChordAfter(itemReferenceId, chordId, chartData)}
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

                              {/* Autocreate from files - collapsible section */}
                              {(() => {
                                const existingCharts = chordCharts[itemReferenceId] || [];
                                const progress = autocreateProgress[itemReferenceId];
                                const zoneExpanded = showAutocreateZone[itemReferenceId];
                                
                                if (existingCharts.length === 0) {
                                  // No existing charts - show expandable autocreate
                                  return (
                                    <div className="w-full mb-4">
                                      <Button
                                        variant="outline"
                                        onClick={() => setShowAutocreateZone(prev => ({ 
                                          ...prev, 
                                          [itemReferenceId]: !prev[itemReferenceId] 
                                        }))}
                                        className="w-full border-green-600 text-green-300 hover:bg-green-800 mb-2 flex items-center justify-center"
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Autocreate Chord Charts
                                      </Button>
                                      
                                      {zoneExpanded && (
                                        <div className="border border-green-600/30 rounded-lg p-4 bg-green-900/10">
                                          <p className="text-sm text-gray-400 mb-6">
                                            To autocreate chord charts for songs in standard tuning: Upload a file showing lyrics with chord names above the lyrics, or a PDF or image showing the chord names written out by song section.

To import chord charts (standard and alternate tunings): Upload a file showing your chord charts, and we'll rebuild them for you here.
                                          </p>
                                          
                                          {/* Single drop zone for all files */}
                                          <div
                                            className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer mb-6 ${
                                              isDragActive[itemReferenceId]
                                                ? 'border-blue-400 bg-blue-900/20'
                                                : 'border-blue-600 hover:border-blue-500 bg-blue-900/10'
                                            }`}
                                            onDragOver={(e) => {
                                              e.preventDefault();
                                              setIsDragActive(prev => ({ ...prev, [itemReferenceId]: true }));
                                            }}
                                            onDragLeave={(e) => {
                                              e.preventDefault();
                                              setIsDragActive(prev => ({ ...prev, [itemReferenceId]: false }));
                                            }}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              setIsDragActive(prev => ({ ...prev, [itemReferenceId]: false }));
                                              handleSingleFileDrop(itemReferenceId, e.dataTransfer.files);
                                            }}
                                            onClick={() => {
                                              const input = document.createElement('input');
                                              input.type = 'file';
                                              input.multiple = true;
                                              input.accept = '.pdf,.png,.jpg,.jpeg';
                                              input.onchange = (e) => handleSingleFileDrop(itemReferenceId, e.target.files);
                                              input.click();
                                            }}
                                          >
                                            <div className="text-center">
                                              <Upload className={`h-16 w-16 mx-auto mb-2 ${
                                                uploadedFiles[itemReferenceId] && uploadedFiles[itemReferenceId].length > 0 ? 'text-blue-400' : 'text-gray-400'
                                              }`} />
                                              <p className={`text-lg font-medium mb-2 ${
                                                uploadedFiles[itemReferenceId] && uploadedFiles[itemReferenceId].length > 0 ? 'text-blue-300' : 'text-gray-300'
                                              }`}>Drop files here or click to browse</p>
                                              <p className="text-gray-400 text-sm mb-4">
                                                PDFs, images (PNG, JPG) • Max 5 files
                                              </p>
                                              {uploadedFiles[itemReferenceId] && uploadedFiles[itemReferenceId].length > 0 ? (
                                                <div>
                                                  <p className="text-blue-400 text-sm font-medium mb-2">
                                                    {uploadedFiles[itemReferenceId].length} file(s) selected:
                                                  </p>
                                                  <div className="text-xs text-gray-400 space-y-1">
                                                    {uploadedFiles[itemReferenceId].map((file, index) => (
                                                      <div key={index}>{file.name}</div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : (
                                                <p className="text-gray-400 text-xs">
                                                  Lyrics with chords (standard tuning only) • Chord charts
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Process Button */}
                                          <div className="flex justify-center">
                                            <Button
                                              variant="outline"
                                              onClick={() => handleProcessFiles(itemReferenceId)}
                                              disabled={progress || (uploadedFiles[itemReferenceId] || []).length === 0}
                                              className={`px-6 ${
                                                progress || (uploadedFiles[itemReferenceId] || []).length === 0
                                                  ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                                                  : 'border-blue-600 text-blue-300 hover:bg-blue-800'
                                              }`}
                                            >
                                              <Wand className="h-4 w-4 mr-2" />
                                              Create Chord Charts
                                            </Button>
                                          </div>
                                          
                                          {/* Progress/Status Display */}
                                          <div
                                            className="w-full p-6 border-2 border-dashed rounded-lg mt-4 bg-gray-800/50 border-gray-600"
                                          >
                                            <div className="text-center">
                                              {progress === 'uploading' && (
                                                <div className="space-y-3">
                                                  <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                    <span className="text-blue-400">Uploading files...</span>
                                                  </div>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCancelAutocreate(itemReferenceId)}
                                                    className="text-gray-400 hover:text-gray-200 border-gray-600"
                                                  >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Cancel
                                                  </Button>
                                                </div>
                                              )}
                                              {progress === 'processing' && (
                                                <div className="space-y-3">
                                                  <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                                                    <div className="flex items-center">
                                                      <span className="text-purple-400">{processingMessages[processingMessageIndex]}</span>
                                                      <div className="ml-2 animate-spin">⚙️</div>
                                                    </div>
                                                  </div>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCancelAutocreate(itemReferenceId)}
                                                    className="text-gray-400 hover:text-gray-200 border-gray-600"
                                                  >
                                                    <X className="h-3 w-3 mr-1" />
                                                    Cancel
                                                  </Button>
                                                </div>
                                              )}
                                              {progress === 'complete' && (
                                                <div className="flex items-center justify-center space-x-2">
                                                  <Check className="h-4 w-4 text-green-500" />
                                                  <span className="text-green-400">Chord charts created!</span>
                                                </div>
                                              )}
                                              {progress === 'error' && (
                                                <div className="flex items-center justify-center space-x-2">
                                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                                  <span className="text-red-400">Error processing files. Please try again.</span>
                                                </div>
                                              )}
                                              {!progress && (
                                                <>
                                                  {chordCharts[itemReferenceId] && chordCharts[itemReferenceId].length > 0 ? (
                                                    <>
                                                      <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                                                      <p className="text-orange-300 font-medium mb-1">Chord charts already exist</p>
                                                      <p className="text-gray-400 text-sm">
                                                        Please delete all chord charts from this song before using autocreate
                                                      </p>
                                                    </>
                                                  ) : (
                                                    <>
                                                      {(() => {
                                                        const hasFiles = (uploadedFiles[itemReferenceId] || []).length > 0;
                                                        
                                                        if (hasFiles) {
                                                          return (
                                                            <>
                                                              <Sparkles className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                                                              <p className="text-blue-300 font-medium mb-1">Ready to create chord charts</p>
                                                              <p className="text-gray-400 text-sm">
                                                                Add more files, or click 'Create chord charts'
                                                              </p>
                                                            </>
                                                          );
                                                        } else {
                                                          return (
                                                            <>
                                                              <Sparkles className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                              <p className="text-gray-300 font-medium mb-1">Add files above, then click 'Create Chord Charts'</p>
                                                              
                                                              <p className="text-gray-400 text-xs mt-2">(The results will probably contain errors, use the ✏️edit icon to make any corrections needed.)</p>
                                                            </>
                                                          );
                                                        }
                                                      })()}
                                                    </>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else {
                                  // Has existing charts - show replace option
                                  return (
                                    <Button
                                      variant="outline"
                                      onClick={() => handleAutocreateClick(itemReferenceId)}
                                      className="w-full mb-4 border-orange-600 text-orange-300 hover:bg-orange-800"
                                    >
                                      <Upload className="h-4 w-4 mr-2" />
                                      Replace with autocreated charts
                                    </Button>
                                  );
                                }
                              })()}

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
                                  insertionContext={insertionContext}
                                  onSave={(chartData) => handleSaveChordChart(itemReferenceId, chartData)}
                                  onCancel={() => {
                                    setShowChordEditor(prev => ({ ...prev, [itemReferenceId]: false }));
                                    setEditingChordId(null);
                                    setInsertionContext(null);
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

      {/* Delete Existing Chord Charts Modal */}
      <AlertDialog open={showDeleteChordsModal} onOpenChange={setShowDeleteChordsModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Replace Existing Chord Charts</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              This song already has chord charts. To use autocreate, all existing chord charts must be deleted first. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteChordsModal(false);
              setDeleteModalItemId(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteExistingCharts}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Delete All & Autocreate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mixed Content Choice Modal */}
      <AlertDialog open={showMixedContentModal} onOpenChange={setShowMixedContentModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-blue-500" />
              <span>Mixed Content Detected</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your file contains both chord names and chord charts. How would you like to process it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowMixedContentModal(false);
              setMixedContentData(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleMixedContentChoice('chord_names')}>
              Process Chord Names
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleMixedContentChoice('chord_charts')}>
              Import Chord Charts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsupported Format Modal */}
      <AlertDialog open={showUnsupportedFormatModal} onOpenChange={setShowUnsupportedFormatModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>{unsupportedFormatData?.title || 'Format Not Supported'}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unsupportedFormatData?.message || 'Sorry, we can only build chord charts. This file format is not supported.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowUnsupportedFormatModal(false);
              setUnsupportedFormatData(null);
            }}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* API Error Modal */}
      <ApiErrorModal 
        isOpen={showApiErrorModal}
        onClose={() => {
          setShowApiErrorModal(false);
          setApiError(null);
        }}
        error={apiError}
      />
    </div>
  );
}; 