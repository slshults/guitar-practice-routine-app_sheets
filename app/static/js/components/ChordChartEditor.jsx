import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@ui/button';
import { Input } from '@ui/input';

const defaultChartConfig = {
  strings: 6,
  frets: 5,
  fretSize: 1.2,          // Normal fret height for readability
  fingerSize: 0.75,       // Larger finger size for better text visibility
  sidePadding: 0.2,       // Standard padding
  fontFamily: 'Arial',
  // Key: set explicit dimensions that work well
  width: 220,             // Even larger width for better visibility
  height: 310,            // Even larger height (taller than wide)
  // Dark theme colors for visibility
  color: '#ffffff',           // White finger dots
  backgroundColor: 'transparent',
  strokeColor: '#ffffff',     // White grid lines
  textColor: '#ffffff',       // White text
  fretLabelColor: '#ffffff',  // White fret labels
  // Finger text settings - using SVGuitar's correct property names
  fingerTextColor: '#000000', // Black text on white dots for contrast
  fingerTextSize: 28          // Larger text size for better visibility
};

// Utility function for API requests with exponential backoff
const fetchWithBackoff = async (url, options = {}, maxRetries = 3, onRetry = null) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited, wait and retry
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const message = `Rate limited. Waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}`;
        console.log(message);
        
        if (onRetry) onRetry(message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const waitTime = Math.pow(2, attempt) * 1000;
      const message = `Request failed. Waiting ${waitTime/1000}s before retry ${attempt + 1}/${maxRetries}`;
      console.log(message);
      
      if (onRetry) onRetry(message);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts`);
};

export const ChordChartEditor = ({ itemId, onSave, onCancel, editingChordId = null, defaultTuning = 'EADGBE' }) => {
  const [title, setTitle] = useState('');
  const [startingFret, setStartingFret] = useState(1);
  const [numFrets, setNumFrets] = useState(5);
  const [numStrings, setNumStrings] = useState(6);
  const [editMode, setEditMode] = useState('dots');
  
  // Keep ref in sync with state
  useEffect(() => {
    editModeRef.current = editMode;
    console.log('EditMode ref updated to:', editMode);
  }, [editMode]);
  const [tuning, setTuning] = useState(defaultTuning);
  const [capo, setCapo] = useState(0);
  
  // Chord data state
  const [fingers, setFingers] = useState([]); // Start with empty chord
  const [barres, setBarres] = useState([]);
  
  // Debug barres state changes
  useEffect(() => {
    console.log('BARRES STATE CHANGED:', JSON.stringify(barres));
  }, [barres]);
  const [openStrings, setOpenStrings] = useState(new Set()); // Track open strings (0)
  const [mutedStrings, setMutedStrings] = useState(new Set()); // Track muted strings (x)
  const [isLoadingChord, setIsLoadingChord] = useState(false); // Loading state for API requests
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false); // Toggle for advanced settings
  const [selectedFinger, setSelectedFinger] = useState(null); // Track selected finger for number input [string, fret]

  const editorChartRef = useRef(null);
  const resultChartRef = useRef(null);
  const editorContainerRef = useRef(null);
  const editModeRef = useRef(editMode);
  const lastChordDataRef = useRef(null);

  // Autofill function to copy existing chord fingerings
  const tryAutofill = async (chordName) => {
    if (!chordName.trim() || !itemId) return;
    
    try {
      setIsLoadingChord(true);
      console.log(`Trying autofill for chord: "${chordName}"`);
      
      // Fetch existing chord charts for this item
      const response = await fetchWithBackoff(`/api/items/${itemId}/chord-charts`, {}, 3, 
        (message) => console.log(`Loading: ${message}`));
      if (!response.ok) {
        console.log(`Failed to fetch chord charts: ${response.status}`);
        return;
      }
      
      const existingChords = await response.json();
      
      // Find matching chord name (case-insensitive)
      const matches = existingChords.filter(chart => 
        chart.title.toLowerCase() === chordName.toLowerCase()
      );
      
      let chordToUse;
      
      if (matches.length === 0) {
        console.log(`No existing chord found for "${chordName}", checking common chords...`);
        
        // Fallback: Search common chords database for specific chord
        try {
          console.log(`Searching common chords for: ${chordName}`);
          
          // Add a reasonable delay to avoid rapid API calls
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const searchResponse = await fetchWithBackoff(`/api/chord-charts/common/search?name=${encodeURIComponent(chordName)}`, {}, 3,
            (message) => console.log(`Searching common chords: ${message}`));
          
          if (searchResponse.ok) {
            const commonMatches = await searchResponse.json();
            console.log(`Found ${commonMatches.length} matching common chords for "${chordName}"`);
            
            // commonMatches is already filtered by the backend
            
            if (commonMatches.length > 0) {
              // Use the first common chord match (they should be curated)
              chordToUse = commonMatches[0];
              console.log(`Found common chord for "${chordName}", auto-filling from database...`);
            } else {
              console.log(`No common chord found for "${chordName}"`);
              // Don't return early - let the finally block clean up
            }
          } else {
            console.log(`Failed to search common chords: ${searchResponse.status} ${searchResponse.statusText}`);
            // Don't fail completely - let the finally block clean up
          }
        } catch (commonError) {
          console.error('Error fetching common chords:', commonError);
          // Don't fail completely - let the finally block clean up
        }
      } else {
        // Found existing chords for this item
        if (matches.length === 1) {
          chordToUse = matches[0];
          console.log(`Found 1 match for "${chordName}", auto-filling...`);
        } else {
          // Multiple matches - use the most recent one (highest order/ID)
          console.log(`Found ${matches.length} matches for "${chordName}", using most recent version`);
          // Sort by order (or ID if order is the same) and take the last one
          matches.sort((a, b) => {
            const orderA = parseInt(a.order) || 0;
            const orderB = parseInt(b.order) || 0;
            if (orderA !== orderB) return orderA - orderB;
            // If order is the same, use ID as tiebreaker
            return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
          });
          chordToUse = matches[matches.length - 1]; // Take the last (most recent)
          console.log(`Using chord with ID ${chordToUse.id} (order: ${chordToUse.order})`);
        }
      }
      
      // Populate editor with existing chord data
      if (chordToUse) {
        console.log('Autofilling with chord data:', chordToUse);
        setStartingFret(chordToUse.startingFret || 1);
        setNumFrets(chordToUse.numFrets || 5);
        setNumStrings(chordToUse.numStrings || 6);
        setTuning(chordToUse.tuning || defaultTuning);
        setCapo(chordToUse.capo || 0);
        
        // Convert finger objects to [string, fret, fingerNumber] arrays if needed
        const fingersData = chordToUse.fingers || [];
        const normalizedFingers = fingersData.map(finger => {
          // If it's already an array, ensure 3 elements
          if (Array.isArray(finger)) {
            const [s, f, num] = finger;
            return [s, f, num]; // Keep all 3 elements (num might be undefined)
          }
          // If it's an object with string/fret properties, convert to array
          if (finger && typeof finger === 'object' && 'string' in finger && 'fret' in finger) {
            // Preserve finger number if it exists
            const fingerNum = finger.fingerNumber || finger[2];
            return [finger.string, finger.fret, fingerNum]; // Always 3 elements
          }
          // Fallback: assume it's already in the right format but ensure 3 elements
          const [s, f, num] = Array.isArray(finger) ? finger : [finger[0], finger[1], finger[2]];
          return [s, f, num];
        });
        console.log('Normalized fingers from', fingersData, 'to', normalizedFingers);
        
        setFingers(normalizedFingers);
        
        // Handle barres from autofill - they should be stored correctly already
        const autofillBarres = chordToUse.barres || [];
        console.log('Autofill barres:', JSON.stringify(autofillBarres));
        console.log('Autofill chord startingFret:', chordToUse.startingFret);
        
        setBarres(autofillBarres);
        setOpenStrings(new Set(chordToUse.openStrings || []));
        setMutedStrings(new Set(chordToUse.mutedStrings || []));
      }
      
    } catch (error) {
      console.error('Error during autofill:', error);
    } finally {
      setIsLoadingChord(false);
    }
  };

  // Load existing chord data when editing
  useEffect(() => {
    if (editingChordId && itemId) {
      const loadChordForEditing = async () => {
        try {
          setIsLoadingChord(true);
          console.log(`Loading chord ${editingChordId} for editing from item ${itemId}`);
          
          const response = await fetchWithBackoff(`/api/items/${itemId}/chord-charts`);
          if (response.ok) {
            const chords = await response.json();
            // Convert editingChordId to same type as chord.id for comparison
            const chordToEdit = chords.find(chord => 
              parseInt(chord.id) === parseInt(editingChordId)
            );
            
            if (chordToEdit) {
              console.log('Loading chord for editing:', chordToEdit);
              console.log('Chord barres from server:', JSON.stringify(chordToEdit.barres));
              setTitle(chordToEdit.title || '');
              setStartingFret(chordToEdit.startingFret || 1);
              setNumFrets(chordToEdit.numFrets || 5);
              setNumStrings(chordToEdit.numStrings || 6);
              setTuning(chordToEdit.tuning || defaultTuning);
              setCapo(chordToEdit.capo || 0);
              
              // Load finger positions (preserve finger numbers)
              const fingersData = chordToEdit.fingers || [];
              const normalizedFingers = fingersData.map(finger => {
                if (Array.isArray(finger)) {
                  const [s, f, num] = finger;
                  return [s, f, num]; // Ensure 3 elements (num might be undefined)
                }
                if (finger && typeof finger === 'object' && 'string' in finger && 'fret' in finger) {
                  // Preserve finger number if it exists
                  const fingerNum = finger.fingerNumber || finger[2];
                  return [finger.string, finger.fret, fingerNum]; // Always 3 elements
                }
                // Fallback: ensure 3 elements
                const [s, f, num] = Array.isArray(finger) ? finger : [finger[0], finger[1], finger[2]];
                return [s, f, num];
              });
              
              console.log('Normalized fingers for editing:', normalizedFingers);
              setFingers(normalizedFingers);
              
              // Handle barres - the stored barre fret numbers might need adjustment
              // based on the loaded chord's startingFret
              const loadedBarres = chordToEdit.barres || [];
              console.log('Loading barres from server:', JSON.stringify(loadedBarres));
              console.log('Loaded chord startingFret:', chordToEdit.startingFret);
              
              // No need to adjust barre fret numbers when loading - they should be stored correctly
              // The issue was in the display/click detection, not in storage
              setBarres(loadedBarres);
              setOpenStrings(new Set(chordToEdit.openStrings || []));
              setMutedStrings(new Set(chordToEdit.mutedStrings || []));
            } else {
              console.warn(`Chord with ID ${editingChordId} not found in response`);
              console.log('Available chords:', chords.map(c => ({ id: c.id, title: c.title })));
            }
          } else {
            console.error('Failed to fetch chord charts:', response.status);
          }
        } catch (error) {
          console.error('Error loading chord for editing:', error);
        } finally {
          setIsLoadingChord(false);
        }
      };
      
      loadChordForEditing();
    } else if (editingChordId) {
      console.warn('editingChordId provided but no itemId');
    } else {
      // Reset form when not editing (new chord)
      console.log('Resetting form for new chord');
      setTitle('');
      setStartingFret(1);
      setNumFrets(5);
      setNumStrings(6);
      setTuning(defaultTuning);
      setCapo(0);
      setFingers([]);
      setBarres([]);
      setOpenStrings(new Set());
      setMutedStrings(new Set());
      setShowAdvancedSettings(false); // Reset to collapsed for new chords
    }
  }, [editingChordId, itemId, defaultTuning]);

  // Initialize SVGuitar
  useEffect(() => {
    // Load SVGuitar UMD script if not already loaded
    if (!window.svguitar) {
      const script = document.createElement('script');
      script.src = '/static/js/svguitar.es5.js';  // Use local version
      script.async = true;
      script.onload = () => {
        initializeCharts();
      };
      document.body.appendChild(script);
    } else {
      initializeCharts();
    }
    
    // Cleanup on unmount
    return () => {
      if (currentHandlerRef.current && currentHandlerRef.current.svg) {
        console.log('Cleaning up event listener on unmount');
        currentHandlerRef.current.svg.removeEventListener('click', currentHandlerRef.current.handler);
      }
    };
  }, []);

  const initializeCharts = () => {
    console.log('Initializing charts, window.svguitar:', window.svguitar);
    try {
      editorChartRef.current = new window.svguitar.SVGuitarChord('#editor-chart');
      resultChartRef.current = new window.svguitar.SVGuitarChord('#result-chart');
      console.log('Charts created successfully');
      updateCharts();
      setupEditorInteraction();
    } catch (error) {
      console.error('Error initializing charts:', error);
    }
  };

  // Store the current event handler reference
  const currentHandlerRef = useRef(null);
  
  const setupEditorInteraction = () => {
    if (!editorContainerRef.current) {
      console.log('setupEditorInteraction: No editor container ref');
      return;
    }

    const svg = editorContainerRef.current.querySelector('svg');
    if (!svg) {
      console.log('setupEditorInteraction: No SVG found');
      return;
    }

    // Remove the old handler if it exists
    if (currentHandlerRef.current && currentHandlerRef.current.svg) {
      console.log('Removing old event listener from previous SVG');
      currentHandlerRef.current.svg.removeEventListener('click', currentHandlerRef.current.handler);
    }
    
    // Create a new handler that captures the current context
    const newHandler = (event) => {
      const handlerId = Math.random();
      console.log('Event handler called, id:', handlerId);
      if (event && event.stopPropagation) {
        event.stopPropagation(); // Prevent event bubbling
      }
      if (event && event.preventDefault) {
        event.preventDefault();  // Prevent default behavior
      }
      handleEditorClick(event);
      console.log('Event handler finished, id:', handlerId);
    };
    
    // Add the new handler
    svg.addEventListener('click', newHandler);
    console.log('setupEditorInteraction: Event listener attached to SVG');
    
    // Store reference for cleanup
    currentHandlerRef.current = { svg, handler: newHandler };
  };

  const handleEditorClick = (event) => {
    if (!event || !event.currentTarget) {
      console.error('handleEditorClick called with invalid event');
      return;
    }
    
    const currentEditMode = editModeRef.current;
    console.log('=== CLICK DEBUG ===');
    console.log('handleEditorClick sees editMode from state as:', editMode);
    console.log('handleEditorClick sees editMode from ref as:', currentEditMode);
    console.log('typeof currentEditMode:', typeof currentEditMode);
    if (currentEditMode !== 'dots' && currentEditMode !== 'fingers' && currentEditMode !== 'barres') return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Calculate coordinates relative to the SVG
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    
    // Account for SVG scaling - the SVG viewBox vs actual display size
    const svgViewBox = svg.viewBox.baseVal;
    
    // Check if SVG is ready - if not, retry after a short delay
    if (!svgViewBox || svgViewBox.width === 0 || svgViewBox.height === 0 || 
        rect.width === 0 || rect.height === 0) {
      console.log('SVG not ready yet, retrying in 100ms...', {
        viewBox: svgViewBox ? { width: svgViewBox.width, height: svgViewBox.height } : null,
        rect: { width: rect.width, height: rect.height }
      });
      
      // Don't retry - just skip this click
      console.log('SVG not ready, skipping click');
      return;
    }
    
    const scaleX = svgViewBox.width / rect.width;
    const scaleY = svgViewBox.height / rect.height;
    
    // Additional safety check for valid scale values
    if (!isFinite(scaleX) || !isFinite(scaleY)) {
      console.error('Invalid scale values:', { scaleX, scaleY });
      return;
    }
    
    const x = rawX * scaleX;
    const y = rawY * scaleY;

    console.log('Click coordinates:', { 
      rawX, rawY, 
      scaleX, scaleY, 
      scaledX: x, scaledY: y, 
      rect: { width: rect.width, height: rect.height },
      viewBox: { width: svgViewBox.width, height: svgViewBox.height }
    });

    // SVGuitar layout analysis:
    // - There's padding around the actual fretboard
    // - Strings are vertical lines, frets are horizontal
    // - Frets are the spaces BETWEEN the fret wires, not the wires themselves
    
    // Use SVG viewBox dimensions for calculations, not display dimensions
    const chartWidth = svgViewBox.width;
    const chartHeight = svgViewBox.height;
    
    // Adjusted margins based on SVGuitar's actual layout
    const marginX = chartWidth * 0.15;
    
    // The key fix: Adjust nut area detection based on starting fret
    // When startingFret > 1, SVGuitar renders with much smaller nut area
    // because it shows the fret number (e.g., "5fr") instead of full nut
    const marginY = startingFret > 1 ? chartHeight * 0.05 : chartHeight * 0.12;
    
    const fretboardWidth = chartWidth - (marginX * 2);
    const fretboardHeight = chartHeight - (marginY * 2);
    
    console.log('Coordinate calculation params:', {
      startingFret,
      marginY,
      chartHeight,
      marginYRatio: marginY / chartHeight
    });
    
    // Check if click is outside the chart area entirely
    if (x < marginX || x > chartWidth - marginX) {
      console.log('Click outside chart area horizontally', { x, marginX, chartWidth });
      return;
    }
    
    // Calculate string (vertical position across width) - same for both nut and fretboard
    const relativeX = x - marginX;
    const stringRatio = relativeX / fretboardWidth;
    const stringIndex = Math.floor(stringRatio * numStrings);
    
    if (stringIndex < 0 || stringIndex >= numStrings) {
      console.log('Invalid string index');
      return;
    }
    
    // Convert to SVGuitar's string numbering (1-based, high E = 1)
    const svguitarString = numStrings - stringIndex; // Flip the order
    
    // Check if click is in the nut area (above the fretboard)
    // For higher position chords, this area is much smaller
    if (y < marginY) {
      console.log('Nut area click on string:', svguitarString, 'y:', y, 'marginY:', marginY);
      toggleNutMarker(svguitarString);
      return;
    }
    
    // Check if click is within fretboard area
    // Use same adjusted marginY for bottom boundary
    if (y > chartHeight - marginY) {
      console.log('Click below fretboard area');
      return;
    }
    
    // Calculate fret (horizontal position down height)
    // The key fix: SVGuitar frets are 1-based, but we need to map clicks to fret spaces
    // Each fret occupies 1/numFrets of the fretboard height
    const relativeY = y - marginY;
    const fretRatio = relativeY / fretboardHeight;
    const fretIndex = Math.floor(fretRatio * numFrets) + 1;
    
    // SVGuitar expects fret numbers relative to the startingFret position
    // So fretIndex is already correct as the relative position

    console.log('Calculated:', { 
      stringIndex, 
      stringRatio,
      fretIndex, 
      fretRatio, 
      relativeX,
      fretboardWidth,
      relativeY, 
      fretboardHeight,
      numStrings, 
      numFrets,
      startingFret 
    });

    if (fretIndex >= 1 && fretIndex <= numFrets) {
      console.log('SVGuitar coordinates:', { svguitarString, fretIndex: fretIndex });
      
      console.log('About to check editMode conditions. currentEditMode =', currentEditMode, 'type:', typeof currentEditMode);
      console.log('currentEditMode === "dots":', currentEditMode === 'dots');
      console.log('currentEditMode === "fingers":', currentEditMode === 'fingers');
      console.log('currentEditMode === "barres":', currentEditMode === 'barres');
      
      if (currentEditMode === 'dots') {
        console.log('Calling toggleFinger');
        toggleFinger(svguitarString, fretIndex);
      } else if (currentEditMode === 'fingers') {
        console.log('Calling selectFingerForNumbering');
        selectFingerForNumbering(svguitarString, fretIndex);
      } else if (currentEditMode === 'barres') {
        console.log('Calling toggleBarre');
        toggleBarre(svguitarString, fretIndex);
      }
    }
  };

  const toggleFinger = (string, fret) => {
    console.log('toggleFinger called with string:', string, 'fret:', fret);
    
    // Remove any nut markers when adding a finger position
    setOpenStrings(prev => {
      const next = new Set(prev);
      next.delete(string);
      return next;
    });
    setMutedStrings(prev => {
      const next = new Set(prev);
      next.delete(string);
      return next;
    });
    
    setFingers(prev => {
      console.log('Current fingers:', prev);
      console.log('Current fingers detailed:', JSON.stringify(prev));
      console.log('Looking for exact match:', [string, fret]);
      const existingIndex = prev.findIndex((finger, index) => {
        console.log(`Index ${index}: comparing finger`, finger, 'with target', [string, fret]);
        const [s, f] = finger;
        console.log(`Extracted [${s}, ${f}] (types: ${typeof s}, ${typeof f}) vs [${string}, ${fret}] (types: ${typeof string}, ${typeof fret})`);
        const matches = s === string && f === fret;
        console.log('Match result:', matches);
        return matches;
      });
      console.log('Existing index:', existingIndex);
      console.log('Checking condition: existingIndex >= 0 =', existingIndex >= 0);
      
      if (existingIndex >= 0) {
        // Remove existing finger
        const newFingers = prev.filter((_, index) => index !== existingIndex);
        console.log('Removing finger, new array:', newFingers);
        return newFingers;
      } else {
        // Add new finger with 3-element structure for finger numbering
        const newFingers = [...prev, [string, fret, undefined]];
        console.log('Adding finger, new array:', newFingers);
        return newFingers;
      }
    });
  };

  const toggleNutMarker = (stringNum) => {
    const isOpen = openStrings.has(stringNum);
    const isMuted = mutedStrings.has(stringNum);
    
    // Remove any fretted notes on this string when adding nut markers
    setFingers(prev => prev.filter(([s]) => s !== stringNum));
    
    if (!isOpen && !isMuted) {
      // State: none → open
      setOpenStrings(prev => new Set([...prev, stringNum]));
    } else if (isOpen) {
      // State: open → muted
      setOpenStrings(prev => {
        const next = new Set(prev);
        next.delete(stringNum);
        return next;
      });
      setMutedStrings(prev => new Set([...prev, stringNum]));
    } else if (isMuted) {
      // State: muted → none
      setMutedStrings(prev => {
        const next = new Set(prev);
        next.delete(stringNum);
        return next;
      });
    }
  };

  const toggleBarre = (string, fret) => {
    console.log('toggleBarre called with string:', string, 'fret:', fret);
    
    setBarres(prev => {
      console.log('Current barres:', JSON.stringify(prev));
      console.log('Looking for barre at fret:', fret);
      const existingIndex = prev.findIndex(barre => {
        console.log('Checking barre:', JSON.stringify(barre), 'fret:', barre.fret, 'vs target fret:', fret);
        return barre.fret === fret;
      });
      console.log('Existing barre index:', existingIndex);
      
      if (existingIndex >= 0) {
        // Remove existing barre
        const newBarres = prev.filter((_, index) => index !== existingIndex);
        console.log('Removing barre, new array:', newBarres);
        return newBarres;
      } else {
        // Add new barre
        const newBarre = {
          fromString: 6,
          toString: 1,
          fret: fret,
          text: '1'
        };
        const newBarres = [...prev, newBarre];
        console.log('Adding barre, new array:', JSON.stringify(newBarres));
        return newBarres;
      }
    });
  };

  const selectFingerForNumbering = (string, fret) => {
    console.log('Selecting finger for numbering:', { string, fret });
    // First ensure there's a finger at this position
    const existingFingerIndex = fingers.findIndex(finger => {
      const [s, f] = finger;
      return s === string && f === fret;
    });
    
    if (existingFingerIndex === -1) {
      // No finger here, add one first but don't trigger re-render immediately
      console.log('No finger found, adding finger first');
      
      // Remove any nut markers when adding a finger position
      setOpenStrings(prev => {
        const next = new Set(prev);
        next.delete(string);
        return next;
      });
      setMutedStrings(prev => {
        const next = new Set(prev);
        next.delete(string);
        return next;
      });
      
      // Add the finger and set it as selected in one batch update
      setFingers(prev => {
        const newFingers = [...prev, [string, fret, undefined]];
        console.log('Added finger, new fingers array:', newFingers);
        return newFingers;
      });
      
      // Set this position as selected for number input
      setSelectedFinger([string, fret]);
      console.log('Selected finger for numbering:', [string, fret]);
    } else {
      console.log('Found existing finger, selecting it');
      // Set this position as selected for number input
      setSelectedFinger([string, fret]);
      console.log('Selected finger for numbering:', [string, fret]);
    }
  };

  const setFingerNumber = (string, fret, number) => {
    console.log('Setting finger number:', { string, fret, number });
    
    setFingers(prev => {
      return prev.map(finger => {
        const [s, f, currentNumber] = finger;
        
        if (s === string && f === fret) {
          return [s, f, number];
        }
        // Ensure all fingers have 3-element structure
        return finger.length === 3 ? finger : [s, f, currentNumber];
      });
    });
  };

  const updateCharts = () => {
    console.log('updateCharts called', { editorChartRef: editorChartRef.current, resultChartRef: resultChartRef.current });
    if (!editorChartRef.current || !resultChartRef.current) {
      console.log('Charts not ready yet');
      return;
    }
    
    // If the chart elements don't exist in DOM, recreate them
    const editorElement = document.querySelector('#editor-chart');
    const resultElement = document.querySelector('#result-chart');
    if (!editorElement || !resultElement) {
      console.log('Chart DOM elements missing, skipping update');
      return;
    }

    try {
      const config = {
        ...defaultChartConfig,
        strings: numStrings,
        frets: numFrets,
        position: startingFret,
        tuning: []  // Empty array to hide SVGuitar's built-in tuning labels
      };

      // Combine regular fingers with open and muted strings
      // Process fingers to ensure proper finger number format for SVGuitar
      const processedFingers = fingers.map(finger => {
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
        ...Array.from(openStrings).map(string => [string, 0]),
        // Add muted strings as [string, 'x']
        ...Array.from(mutedStrings).map(string => [string, 'x'])
      ];

      const chordData = {
        fingers: allFingers,
        barres
      };

      console.log('Drawing charts with config:', config, 'chordData:', chordData);
      console.log('Raw fingers state:', fingers);
      console.log('AllFingers being sent to SVGuitar:', allFingers);
      console.log('AllFingers detailed:', JSON.stringify(allFingers));
      console.log('Config fingerTextColor:', config.fingerTextColor);
      console.log('Config fingerTextSize:', config.fingerTextSize);
      
      // Debug: Check finger structure
      allFingers.forEach((finger, i) => {
        console.log(`Finger ${i}:`, finger, 'length:', finger.length, 'has finger number:', finger[2] !== undefined);
      });

      // Check if chord data or title has actually changed
      const chartStateString = JSON.stringify({ chordData, title });
      const hasChanged = chartStateString !== lastChordDataRef.current;
      
      if (hasChanged) {
        console.log('Chart state changed, redrawing charts');
        lastChordDataRef.current = chartStateString;
        
        // Update existing charts without recreating them
        editorChartRef.current
          .configure(config)
          .chord(chordData)
          .draw();

        resultChartRef.current
          .configure({
            ...config,
            title
          })
          .chord(chordData)
          .draw();

        console.log('Charts drawn successfully');
      } else {
        console.log('Chord data unchanged, skipping redraw');
      }
      
      // Add explicit debug output to check if finger text is being applied
      setTimeout(() => {
        const editorSvg = document.querySelector('#editor-chart svg');
        const resultSvg = document.querySelector('#result-chart svg');
        
        // Check for finger text elements in the SVG
        if (editorSvg) {
          const fingerTextElements = editorSvg.querySelectorAll('text[fill="#000000"]');
          console.log('Found finger text elements in editor SVG:', fingerTextElements.length);
          fingerTextElements.forEach((el, i) => {
            console.log(`Finger text ${i}:`, el.textContent, 'at position', el.getAttribute('x'), el.getAttribute('y'));
          });
        }
        
        if (resultSvg) {
          const fingerTextElements = resultSvg.querySelectorAll('text[fill="#000000"]');
          console.log('Found finger text elements in result SVG:', fingerTextElements.length);
          fingerTextElements.forEach((el, i) => {
            console.log(`Finger text ${i}:`, el.textContent, 'at position', el.getAttribute('x'), el.getAttribute('y'));
          });
        }
        
        // Style the SVGs
        if (editorSvg) {
          editorSvg.style.width = '100%';
          editorSvg.style.height = '100%';
          editorSvg.style.maxWidth = '208px';  // Match container width w-52
          editorSvg.style.maxHeight = '320px'; // Match container height h-80
        }
        
        if (resultSvg) {
          resultSvg.style.width = '100%';
          resultSvg.style.height = '100%';
          resultSvg.style.maxWidth = '208px';  // Match container width w-52
          resultSvg.style.maxHeight = '320px'; // Match container height h-80
        }
        
        console.log('Setting up editor interaction after SVG styling');
        setupEditorInteraction();
      }, 100);
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  };

  useEffect(() => {
    updateCharts();
  }, [title, startingFret, numFrets, numStrings, fingers, barres, tuning, openStrings, mutedStrings]);

  // Keyboard event listener for finger numbers
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (editMode !== 'fingers' || !selectedFinger) return;
      
      const key = event.key;
      if (['1', '2', '3', '4', '5'].includes(key)) {
        const [string, fret] = selectedFinger;
        setFingerNumber(string, fret, key);
        setSelectedFinger(null); // Clear selection after setting number
        event.preventDefault();
      } else if (key === 'Escape') {
        setSelectedFinger(null); // Clear selection on escape
        event.preventDefault();
      }
    };

    if (editMode === 'fingers') {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [editMode, selectedFinger]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="space-y-4">
        {/* Chord Name field */}
        <div>
          <div className="text-sm text-blue-400 mb-1">Chord Name</div>
          <div className="relative">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => tryAutofill(title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  tryAutofill(title);
                }
              }}
              placeholder="Enter chord name (e.g. Am, C7)"
              className="bg-gray-900"
              disabled={isLoadingChord}
            />
            {isLoadingChord && (
              <div className="absolute right-2 top-2 text-yellow-400 text-xs">
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Show more settings toggle */}
        <div 
          className="text-sm text-blue-400 hover:underline cursor-pointer"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
        >
          {showAdvancedSettings ? 'Hide advanced settings...' : 'Show more settings...'}
        </div>

        {/* Advanced settings - collapsible */}
        {showAdvancedSettings && (
          <div className="space-y-4">
            {/* Basic advanced settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-green-400 mb-1">Tuning</div>
                <Input
                  value={tuning}
                  onChange={(e) => setTuning(e.target.value)}
                  placeholder="EADGBE"
                  className="bg-gray-900"
                />
              </div>
              <div>
                <div className="text-sm text-yellow-400 mb-1">Capo</div>
                <Input
                  type="number"
                  min="0"
                  max="12"
                  value={capo}
                  onChange={(e) => setCapo(parseInt(e.target.value) || 0)}
                  className="bg-gray-900"
                />
              </div>
              <div>
                <div className="text-sm text-red-400 mb-1">Starting fret</div>
                <Input
                  type="number"
                  min="1"
                  max="15"
                  value={startingFret}
                  onChange={(e) => setStartingFret(parseInt(e.target.value) || 1)}
                  className="bg-gray-900"
                />
              </div>
            </div>

            {/* Second row of advanced settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-blue-400 mb-1">Number of frets</div>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={numFrets}
                  onChange={(e) => setNumFrets(parseInt(e.target.value) || 5)}
                  className="bg-gray-900"
                />
              </div>
              <div>
                <div className="text-sm text-red-400 mb-1">Number of strings</div>
                <Input
                  type="number"
                  min="4"
                  max="12"
                  value={numStrings}
                  onChange={(e) => setNumStrings(parseInt(e.target.value) || 6)}
                  className="bg-gray-900"
                />
              </div>
            </div>
          </div>
        )}


        {/* Editor and Result sections */}
        <div className="flex gap-8 justify-center">
          <div>
            <div className="text-lg font-serif mb-4">Editor</div>
            <div className="border border-gray-700 rounded-lg p-4">
              <div className="relative w-52 h-80 mx-auto flex items-center justify-center overflow-hidden">
                <div id="editor-chart" ref={editorContainerRef} className="cursor-pointer" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-lg font-serif mb-4">Result</div>
            <div className="border border-gray-700 rounded-lg p-4">
              <div className="relative w-52 h-80 mx-auto flex items-center justify-center overflow-hidden">
                <div id="result-chart" />
              </div>
            </div>
          </div>
        </div>


        {/* Edit mode buttons */}
        <div className="flex gap-2">
          <Button
            variant={editMode === 'dots' ? 'default' : 'outline'}
            onClick={() => setEditMode('dots')}
            className={`flex-1 ${
              editMode === 'dots' 
                ? 'bg-blue-700 hover:bg-blue-800 text-white' 
                : 'bg-black hover:bg-gray-800 text-gray-300 border border-gray-600'
            }`}
          >
            Edit Dots
          </Button>
          <Button
            variant={editMode === 'fingers' ? 'default' : 'outline'}
            onClick={() => {
              console.log('Edit Fingers button clicked, setting mode to fingers');
              setEditMode('fingers');
            }}
            className={`flex-1 ${
              editMode === 'fingers' 
                ? '!bg-blue-800 hover:!bg-blue-900 !text-white !border !border-blue-600' 
                : '!bg-black hover:!bg-gray-800 !text-gray-300 !border !border-gray-600'
            }`}
          >
            Edit Fingers
          </Button>
          <Button
            variant={editMode === 'barres' ? 'default' : 'outline'}
            onClick={() => setEditMode('barres')}
            className={`flex-1 ${
              editMode === 'barres' 
                ? '!bg-green-700 hover:!bg-green-800 !text-white !border !border-green-600' 
                : '!bg-black hover:!bg-gray-800 !text-gray-300 !border !border-gray-600'
            }`}
          >
            Edit Barres
          </Button>
        </div>

        {/* Mode-specific instructions */}
        {editMode === 'barres' && (
          <div className="bg-green-900 bg-opacity-50 border border-green-600 rounded-lg p-3 text-sm text-green-200">
            <div className="font-semibold mb-1">Barre Mode Instructions:</div>
            <div>Click on any fret to add/remove a full barre across all strings at that fret. Perfect for chords like F, B, F#m, etc.</div>
          </div>
        )}
        
        {editMode === 'fingers' && (
          <div className="bg-blue-900 bg-opacity-50 border border-blue-600 rounded-lg p-3 text-sm text-blue-200">
            <div className="font-semibold mb-1">Finger Numbers Mode Instructions:</div>
            <div>Click on a finger position, then press 1-5 keys to assign finger numbers (5 = thumb). Press Escape to cancel selection.</div>
            {selectedFinger && (
              <div className="mt-2 text-yellow-300">
                Selected position: String {selectedFinger[0]}, Fret {selectedFinger[1]} - Press 1, 2, 3, 4, or 5
              </div>
            )}
          </div>
        )}
        

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              console.log('=== CHORD SAVE DEBUG ===');
              console.log('Saving chord chart with title:', title);
              console.log('Fingers state before save:', fingers);
              console.log('Fingers detailed:', JSON.stringify(fingers));
              console.log('Open strings:', Array.from(openStrings));
              console.log('Muted strings:', Array.from(mutedStrings));
              console.log('Editing chord ID:', editingChordId);
              
              const saveData = { 
                title, 
                startingFret, 
                numFrets, 
                numStrings, 
                tuning, 
                capo, 
                fingers, 
                barres,
                openStrings: Array.from(openStrings),
                mutedStrings: Array.from(mutedStrings),
                editingChordId  // Pass this so the save handler knows whether to create or update
              };
              
              console.log('=== SAVE DATA BEING SENT ===');
              console.log('Full save data:', JSON.stringify(saveData));
              console.log('Save data fingers specifically:', JSON.stringify(saveData.fingers));
              
              onSave(saveData);
            }} 
            className={`flex-1 ${title.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
            disabled={!title.trim()}
          >
            {editingChordId ? 'Update Chord Chart' : 'Add Chord Chart'}
          </Button>
          
          {onCancel && (
            <Button 
              onClick={onCancel}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 