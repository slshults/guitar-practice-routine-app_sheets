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
  width: 160,             // Explicit width
  height: 240             // Explicit height (taller than wide)
};

export const ChordChartEditor = ({ onSave, defaultTuning = 'EADGBE' }) => {
  const [title, setTitle] = useState('');
  const [startingFret, setStartingFret] = useState(1);
  const [numFrets, setNumFrets] = useState(5);
  const [numStrings, setNumStrings] = useState(6);
  const [editMode, setEditMode] = useState('fingers');
  const [tuning, setTuning] = useState(defaultTuning);
  const [capo, setCapo] = useState(0);
  
  // Chord data state
  const [fingers, setFingers] = useState([[1, 1], [2, 2], [6, 3]]); // Default C chord for testing
  const [barres, setBarres] = useState([]);

  const editorChartRef = useRef(null);
  const resultChartRef = useRef(null);
  const editorContainerRef = useRef(null);

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
    if (editMode !== 'fingers') return;

    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    console.log('Click coordinates:', { x, y, rect });

    // SVGuitar layout analysis:
    // - There's padding around the actual fretboard
    // - Strings are vertical lines, frets are horizontal
    // - We need to account for margins and actual fretboard area
    
    const chartWidth = rect.width;
    const chartHeight = rect.height;
    
    // Estimate the actual fretboard area (excluding margins)
    const marginX = chartWidth * 0.15; // ~15% margin on each side
    const marginY = chartHeight * 0.1;  // ~10% margin top/bottom
    const fretboardWidth = chartWidth - (marginX * 2);
    const fretboardHeight = chartHeight - (marginY * 2);
    
    // Check if click is within fretboard area
    if (x < marginX || x > chartWidth - marginX || y < marginY || y > chartHeight - marginY) {
      console.log('Click outside fretboard area');
      return;
    }
    
    // Calculate string (vertical position across width)
    const relativeX = x - marginX;
    const stringIndex = Math.round(relativeX / (fretboardWidth / (numStrings - 1)));
    
    // Calculate fret (horizontal position down height)
    const relativeY = y - marginY;
    const fretIndex = Math.round(relativeY / (fretboardHeight / numFrets));

    console.log('Calculated:', { stringIndex, fretIndex, numStrings, numFrets });

    if (stringIndex >= 0 && stringIndex < numStrings && fretIndex >= 0 && fretIndex < numFrets) {
      // Convert to SVGuitar's string numbering (1-based, high E = 1)
      const svguitarString = numStrings - stringIndex; // Flip the order
      const svguitarFret = fretIndex + startingFret;
      
      console.log('SVGuitar coordinates:', { svguitarString, svguitarFret });
      toggleFinger(svguitarString, svguitarFret);
    }
  };

  const toggleFinger = (string, fret) => {
    console.log('toggleFinger called with:', { string, fret });
    setFingers(prev => {
      console.log('Current fingers:', prev);
      const existingIndex = prev.findIndex(([s, f]) => s === string && f === fret);
      console.log('Existing index:', existingIndex);
      
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

      const chordData = {
        fingers,
        barres
      };

      console.log('Drawing charts with config:', config, 'chordData:', chordData);

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
          editorSvg.style.maxWidth = '160px';
          editorSvg.style.maxHeight = '240px';
        }
        
        if (resultSvg) {
          resultSvg.style.width = '100%';
          resultSvg.style.height = '100%';
          resultSvg.style.maxWidth = '160px';
          resultSvg.style.maxHeight = '240px';
        }
        
        setupEditorInteraction();
      }, 100);
    } catch (error) {
      console.error('Error updating charts:', error);
    }
  };

  useEffect(() => {
    updateCharts();
  }, [title, startingFret, numFrets, numStrings, fingers, barres, tuning]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="space-y-4">
        {/* Basic settings in a row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-blue-400 mb-1">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
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
              {/* Tuning letters above the chart */}
              <div className="w-40 mx-auto text-center mb-1 text-gray-400 text-xs tracking-widest">
                {tuning.split('').join(' ')}
              </div>
              <div className="relative w-40 h-60 mx-auto flex items-center justify-center overflow-hidden">
                <div id="editor-chart" ref={editorContainerRef} className="cursor-pointer" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-lg font-serif mb-4">Result</div>
            <div className="border border-gray-700 rounded-lg p-4">
              {/* Tuning letters above the chart */}
              <div className="w-40 mx-auto text-center mb-1 text-gray-400 text-xs tracking-widest">
                {tuning.split('').join(' ')}
              </div>
              <div className="relative w-40 h-60 mx-auto flex items-center justify-center overflow-hidden">
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
            variant={editMode === 'text' ? 'default' : 'outline'}
            onClick={() => setEditMode('text')}
            className="flex-1 border-gray-600"
          >
            Edit Text
          </Button>
        </div>

        {/* Save button */}
        <Button 
          onClick={() => onSave({ 
            title, 
            startingFret, 
            numFrets, 
            numStrings, 
            tuning, 
            capo, 
            fingers, 
            barres 
          })} 
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={!title.trim()}
        >
          Add Chord Chart
        </Button>
      </div>
    </div>
  );
}; 