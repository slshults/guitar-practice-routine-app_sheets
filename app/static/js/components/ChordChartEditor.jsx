import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@ui/button';
import { Input } from '@ui/input';

const defaultChartConfig = {
  strings: 6,
  frets: 5,
  fretSize: 1.2,          // Normal fret height for readability
  fingerSize: 0.55,       // Normal finger size
  sidePadding: 0.2,       // Standard padding
  fontFamily: 'Arial',
  // Key: set explicit dimensions that work well
  width: 220,             // Even larger width for better visibility
  height: 310             // Even larger height (taller than wide)
};

export const ChordChartEditor = ({ itemId, onSave, onCancel, editingChordId = null, defaultTuning = 'EADGBE' }) => {
  const [title, setTitle] = useState('');
  const [startingFret, setStartingFret] = useState(1);
  const [numFrets, setNumFrets] = useState(5);
  const [numStrings, setNumStrings] = useState(6);
  const [editMode, setEditMode] = useState('fingers');
  const [tuning, setTuning] = useState(defaultTuning);
  const [capo, setCapo] = useState(0);
  
  // Chord data state
  const [fingers, setFingers] = useState([]); // Start with empty chord
  const [barres, setBarres] = useState([]);
  const [openStrings, setOpenStrings] = useState(new Set()); // Track open strings (0)
  const [mutedStrings, setMutedStrings] = useState(new Set()); // Track muted strings (x)

  const editorChartRef = useRef(null);
  const resultChartRef = useRef(null);
  const editorContainerRef = useRef(null);

  // Autofill function to copy existing chord fingerings
  const tryAutofill = async (chordName) => {
    if (!chordName.trim() || !itemId) return;
    
    try {
      console.log(`Trying autofill for chord: "${chordName}"`);
      
      // Fetch existing chord charts for this item
      const response = await fetch(`/api/items/${itemId}/chord-charts`);
      if (!response.ok) return;
      
      const existingChords = await response.json();
      
      // Find matching chord name (case-insensitive)
      const matches = existingChords.filter(chart => 
        chart.title.toLowerCase() === chordName.toLowerCase()
      );
      
      if (matches.length === 0) {
        console.log(`No existing chord found for "${chordName}"`);
        return;
      }
      
      let chordToUse;
      
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
      
      // Populate editor with existing chord data
      if (chordToUse) {
        console.log('Autofilling with chord data:', chordToUse);
        setStartingFret(chordToUse.startingFret || 1);
        setNumFrets(chordToUse.numFrets || 5);
        setNumStrings(chordToUse.numStrings || 6);
        setTuning(chordToUse.tuning || defaultTuning);
        setCapo(chordToUse.capo || 0);
        setFingers(chordToUse.fingers || []);
        setBarres(chordToUse.barres || []);
        setOpenStrings(new Set(chordToUse.openStrings || []));
        setMutedStrings(new Set(chordToUse.mutedStrings || []));
      }
      
    } catch (error) {
      console.error('Error during autofill:', error);
    }
  };

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

  const setupEditorInteraction = () => {
    if (!editorContainerRef.current) return;

    const svg = editorContainerRef.current.querySelector('svg');
    if (!svg) return;

    // Add click handler to the editor chart SVG
    svg.addEventListener('click', handleEditorClick);
  };

  const handleEditorClick = (event) => {
    if (editMode !== 'fingers' && editMode !== 'barres') return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log('Click coordinates:', { x, y, rect });

    // SVGuitar layout analysis:
    // - There's padding around the actual fretboard
    // - Strings are vertical lines, frets are horizontal
    // - Frets are the spaces BETWEEN the fret wires, not the wires themselves
    
    const chartWidth = rect.width;
    const chartHeight = rect.height;
    
    // Adjusted margins based on SVGuitar's actual layout
    const marginX = chartWidth * 0.15;
    const marginY = chartHeight * 0.12;
    const fretboardWidth = chartWidth - (marginX * 2);
    const fretboardHeight = chartHeight - (marginY * 2);
    
    // Check if click is outside the chart area entirely
    if (x < marginX || x > chartWidth - marginX) {
      console.log('Click outside chart area horizontally');
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
    if (y < marginY) {
      console.log('Nut area click on string:', svguitarString);
      toggleNutMarker(svguitarString);
      return;
    }
    
    // Check if click is within fretboard area
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
      numFrets 
    });

    if (fretIndex >= 1 && fretIndex <= numFrets) {
      const svguitarFret = fretIndex;
      console.log('SVGuitar coordinates:', { svguitarString, svguitarFret });
      
      if (editMode === 'fingers') {
        toggleFinger(svguitarString, svguitarFret);
      } else if (editMode === 'barres') {
        toggleBarre(svguitarString, svguitarFret);
      }
    }
  };

  const toggleFinger = (string, fret) => {
    console.log('toggleFinger called with:', { string, fret });
    
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
        // Add new finger
        const newFingers = [...prev, [string, fret]];
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
    console.log('toggleBarre called with:', { string, fret });
    
    // Check if there's already a barre at this fret
    const existingBarreIndex = barres.findIndex(barre => barre.fret === fret);
    
    if (existingBarreIndex >= 0) {
      // Remove existing barre at this fret
      setBarres(prev => prev.filter((_, index) => index !== existingBarreIndex));
      console.log('Removed barre at fret', fret);
    } else {
      // Add new barre from string 6 to string 1 at this fret
      const newBarre = {
        fromString: 6,      // Start from lowest string (6th string)
        toString: 1,        // End at highest string (1st string)
        fret: fret,
        text: '1'           // Default finger number
      };
      
      setBarres(prev => [...prev, newBarre]);
      console.log('Added barre at fret', fret, ':', newBarre);
      
      // Remove any individual finger positions that would conflict with the barre
      setFingers(prev => prev.filter(([, fingerFret]) => fingerFret !== fret));
      
      // Remove any nut markers since barres don't work with open strings
      setOpenStrings(new Set());
      setMutedStrings(new Set());
    }
  };

  const updateCharts = () => {
    console.log('updateCharts called', { editorChartRef: editorChartRef.current, resultChartRef: resultChartRef.current });
    if (!editorChartRef.current || !resultChartRef.current) {
      console.log('Charts not ready yet');
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
      const allFingers = [
        ...fingers,
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
      console.log('Fingers being sent to SVGuitar:', fingers);

      // Clear previous charts by recreating the chart instances
      // SVGuitar doesn't have a clear() method, so we need to recreate the instances
      document.querySelector('#editor-chart').innerHTML = '';
      document.querySelector('#result-chart').innerHTML = '';
      
      editorChartRef.current = new window.svguitar.SVGuitarChord('#editor-chart');
      resultChartRef.current = new window.svguitar.SVGuitarChord('#result-chart');

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
      
      // After drawing, adjust SVG size to fit containers
      setTimeout(() => {
        const editorSvg = document.querySelector('#editor-chart svg');
        const resultSvg = document.querySelector('#result-chart svg');
        
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
        
        setupEditorInteraction();
      }, 100);
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  };

  useEffect(() => {
    updateCharts();
  }, [title, startingFret, numFrets, numStrings, fingers, barres, tuning, openStrings, mutedStrings]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="space-y-4">
        {/* Basic settings in a row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-blue-400 mb-1">Chord Name</div>
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
            />
          </div>
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
        </div>

        {/* Advanced settings in a row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-red-400 mb-1">Starting fret</div>
            <Input
              type="number"
              min="1"
              max="24"
              value={startingFret}
              onChange={(e) => setStartingFret(parseInt(e.target.value) || 1)}
              className="bg-gray-900"
            />
          </div>
          <div>
            <div className="text-sm text-blue-400 mb-1">Number of frets</div>
            <Input
              type="number"
              min="1"
              max="24"
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

        {/* Show more settings button */}
        <div className="text-sm text-blue-400 hover:underline cursor-pointer">
          Show more settings...
        </div>

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
            variant={editMode === 'fingers' ? 'default' : 'outline'}
            onClick={() => setEditMode('fingers')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            Edit Fingers
          </Button>
          <Button
            variant={editMode === 'barres' ? 'default' : 'outline'}
            onClick={() => setEditMode('barres')}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            Edit Barres
          </Button>
          <Button
            variant={editMode === 'text' ? 'default' : 'outline'}
            onClick={() => setEditMode('text')}
            className="flex-1 border-gray-600"
          >
            Edit Text
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
            <div className="font-semibold mb-1">Finger Mode Instructions:</div>
            <div>Click on frets to place individual finger positions. Click above the nut for open (O) or muted (X) strings.</div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              console.log('Saving chord chart with title:', title, {
                openStrings: Array.from(openStrings),
                mutedStrings: Array.from(mutedStrings),
                fingers,
                barres,
                editingChordId
              });
              onSave({ 
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
              });
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