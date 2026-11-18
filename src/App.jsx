import { useCallback, useEffect, useMemo, useState } from 'react';
import CageEditorPanel from './components/CageEditorPanel.jsx';
import Header from './components/Header.jsx';
import ImageOcrPanel from './components/ImageOcrPanel.jsx';
import KenKenGrid from './components/KenKenGrid.jsx';
import PlaySolvePanel from './components/PlaySolvePanel.jsx';
import VisualizerPanel from './components/VisualizerPanel.jsx';
import { cellKey, normalizeOperator } from './engine/kenkenConstants.js';
import { CURATED_PRESETS, generateKenKen } from './engine/kenkenGenerator.js';
import { solveKenKen } from './engine/kenkenSolver.js';
import { validatePuzzle } from './engine/kenkenValidator.js';

function createEmptyBoard(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function checkCageSatisfied(values, op, target) {
  const norm = normalizeOperator(op);
  if (norm === '=') return values.length === 1 && values[0] === target;
  if (norm === '+') return values.reduce((a, b) => a + b, 0) === target;
  if (norm === '×') return values.reduce((a, b) => a * b, 1) === target;
  if (norm === '-' && values.length === 2) return Math.abs(values[0] - values[1]) === target;
  if (norm === '÷' && values.length === 2) {
    const hi = Math.max(values[0], values[1]);
    const lo = Math.min(values[0], values[1]);
    return lo > 0 && hi === lo * target;
  }
  return false;
}

export default function App() {
  // Light / Dark theme state synced with <html class="dark">
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kenken-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kenken-theme', theme);
  }, [theme]);

  // Core puzzle state
  const initialPreset = CURATED_PRESETS[0];
  const [activeMode, setActiveMode] = useState('play');
  const [size, setSize] = useState(initialPreset.size);
  const [difficulty, setDifficulty] = useState('medium');
  const [cages, setCages] = useState(initialPreset.cages);
  const [givens, setGivens] = useState(() => createEmptyBoard(initialPreset.size));
  const [boardValues, setBoardValues] = useState(() => createEmptyBoard(initialPreset.size));
  const [puzzleTitle, setPuzzleTitle] = useState(initialPreset.name);

  // Selection & editor state
  const [selectedCell, setSelectedCell] = useState([0, 0]);
  const [editorSelection, setEditorSelection] = useState([]);
  const [isDraggingSelect, setIsDraggingSelect] = useState(false);
  const [dragOriginCell, setDragOriginCell] = useState(null);
  const [dragMoved, setDragMoved] = useState(false);
  const [highlightedCells, setHighlightedCells] = useState([]);
  const [lastOcrSummary, setLastOcrSummary] = useState(null);

  // Solver & visualizer state
  const [solveResult, setSolveResult] = useState(null);
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0);
  const [visStepIdx, setVisStepIdx] = useState(0);
  const [isVisPlaying, setIsVisPlaying] = useState(false);
  const [visSpeedMs, setVisSpeedMs] = useState(380);
  const [showCandidates, setShowCandidates] = useState(true);

  const puzzleObj = useMemo(
    () => ({ size, cages, givens }),
    [size, cages, givens]
  );

  const validation = useMemo(() => validatePuzzle(puzzleObj), [puzzleObj]);

  // Compute live user play conflicts (row/col duplicates and completed cage mismatches)
  const { conflictMap, userSolvedCorrectly } = useMemo(() => {
    const map = new Map();
    if (activeMode !== 'play') {
      return { conflictMap: map, userSolvedCorrectly: false };
    }

    let filledCount = 0;

    // Row duplicates
    for (let r = 0; r < size; r++) {
      const seen = new Map();
      for (let c = 0; c < size; c++) {
        const v = boardValues[r]?.[c] || 0;
        if (v > 0) {
          filledCount++;
          if (seen.has(v)) {
            map.set(cellKey(r, c), true);
            map.set(cellKey(r, seen.get(v)), true);
          } else {
            seen.set(v, c);
          }
        }
      }
    }

    // Column duplicates
    for (let c = 0; c < size; c++) {
      const seen = new Map();
      for (let r = 0; r < size; r++) {
        const v = boardValues[r]?.[c] || 0;
        if (v > 0) {
          if (seen.has(v)) {
            map.set(cellKey(r, c), true);
            map.set(cellKey(seen.get(v), c), true);
          } else {
            seen.set(v, r);
          }
        }
      }
    }

    // Completed cage arithmetic checks
    let allCagesSatisfied = validation.valid;
    for (const cage of cages) {
      const vals = cage.cells.map(([r, c]) => boardValues[r]?.[c] || 0);
      if (vals.every((v) => v > 0)) {
        if (!checkCageSatisfied(vals, cage.op, cage.target)) {
          allCagesSatisfied = false;
          for (const [r, c] of cage.cells) {
            map.set(cellKey(r, c), true);
          }
        }
      } else {
        allCagesSatisfied = false;
      }
    }

    const solved =
      validation.valid &&
      filledCount === size * size &&
      map.size === 0 &&
      allCagesSatisfied &&
      solveResult?.status !== 'unique' &&
      solveResult?.status !== 'multiple';

    return { conflictMap: map, userSolvedCorrectly: solved };
  }, [activeMode, boardValues, cages, size, validation.valid, solveResult]);

  // Cells that differ between Solution 1 and Solution 2 for multi-solution puzzles
  const diffCells = useMemo(() => {
    if (solveResult?.status !== 'multiple' || solveResult.solutions.length < 2) return [];
    const s1 = solveResult.solutions[0];
    const s2 = solveResult.solutions[1];
    const diffs = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (s1[r]?.[c] !== s2[r]?.[c]) {
          diffs.push([r, c]);
        }
      }
    }
    return diffs;
  }, [solveResult, size]);

  // Determine whether current editor selection exactly matches an existing cage
  const activeCageForEdit = useMemo(() => {
    if (editorSelection.length === 0) return null;
    const selKeys = new Set(editorSelection.map(([r, c]) => cellKey(r, c)));
    return (
      cages.find(
        (cage) =>
          cage.cells.length === selKeys.size &&
          cage.cells.every(([r, c]) => selKeys.has(cellKey(r, c)))
      ) || null
    );
  }, [cages, editorSelection]);

  const resetSolverState = useCallback(() => {
    setSolveResult(null);
    setActiveSolutionIndex(0);
    setVisStepIdx(0);
    setIsVisPlaying(false);
    setHighlightedCells([]);
  }, []);

  const handleGenerate = useCallback(
    (targetSize = size, targetDiff = difficulty) => {
      const generated = generateKenKen(targetSize, targetDiff);
      setSize(generated.size);
      setCages(generated.cages);
      setGivens(createEmptyBoard(generated.size));
      setBoardValues(createEmptyBoard(generated.size));
      setSelectedCell([0, 0]);
      setEditorSelection([]);
      setLastOcrSummary(null);
      setPuzzleTitle(`Generated ${generated.size}×${generated.size}`);
      resetSolverState();
    },
    [size, difficulty, resetSolverState]
  );

  const handleLoadPreset = useCallback(
    (preset) => {
      setSize(preset.size);
      setCages(preset.cages);
      setGivens(createEmptyBoard(preset.size));
      setBoardValues(createEmptyBoard(preset.size));
      setSelectedCell([0, 0]);
      setEditorSelection([]);
      setLastOcrSummary(null);
      setPuzzleTitle(preset.name);
      resetSolverState();
    },
    [resetSolverState]
  );

  const handleInputDigit = useCallback(
    (digit) => {
      if (!selectedCell || activeMode !== 'play') return;
      const [r, c] = selectedCell;
      if (digit < 0 || digit > size) return;
      setBoardValues((prev) => {
        const next = prev.map((row) => row.slice());
        next[r][c] = digit;
        return next;
      });
    },
    [selectedCell, activeMode, size]
  );

  // Keyboard navigation & digit entry in Play mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (activeMode !== 'play') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key >= '1' && e.key <= '9') {
        const num = Number(e.key);
        if (num <= size) {
          e.preventDefault();
          handleInputDigit(num);
        }
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleInputDigit(0);
        return;
      }

      if (!selectedCell) return;
      const [r, c] = selectedCell;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell([Math.max(0, r - 1), c]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell([Math.min(size - 1, r + 1), c]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell([r, Math.max(0, c - 1)]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell([r, Math.min(size - 1, c + 1)]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeMode, selectedCell, size, handleInputDigit]);

  const handleSolve = useCallback(
    (openVisualizer = false) => {
      const result = solveKenKen(puzzleObj, {
        maxSolutions: 2,
        recordSteps: true,
        maxSteps: 2000,
      });
      setSolveResult(result);
      setActiveSolutionIndex(0);
      setVisStepIdx(0);
      setIsVisPlaying(false);

      if (result.solutions.length > 0 && !openVisualizer) {
        setBoardValues(result.solutions[0].map((row) => row.slice()));
      }

      if (!result.validation.valid) {
        const firstErrCells = result.validation.errors.find((e) => e.cells)?.cells || [];
        setHighlightedCells(firstErrCells);
      } else {
        setHighlightedCells([]);
      }

      if (openVisualizer && result.validation.valid) {
        setActiveMode('visualize');
      }
    },
    [puzzleObj]
  );

  const handleSelectSolutionIndex = (idx) => {
    setActiveSolutionIndex(idx);
    if (solveResult?.solutions?.[idx]) {
      setBoardValues(solveResult.solutions[idx].map((row) => row.slice()));
    }
  };

  const handleHint = () => {
    const result = solveKenKen(puzzleObj, { maxSolutions: 1, recordSteps: false });
    if (result.solutions.length === 0) {
      setSolveResult(result);
      return;
    }
    const sol = result.solutions[0];
    let target = selectedCell;
    if (!target || boardValues[target[0]][target[1]] === sol[target[0]][target[1]]) {
      // Find first empty or incorrect cell
      target = null;
      for (let r = 0; r < size && !target; r++) {
        for (let c = 0; c < size && !target; c++) {
          if (boardValues[r][c] !== sol[r][c]) {
            target = [r, c];
          }
        }
      }
    }
    if (target) {
      const [tr, tc] = target;
      setSelectedCell([tr, tc]);
      setBoardValues((prev) => {
        const next = prev.map((row) => row.slice());
        next[tr][tc] = sol[tr][tc];
        return next;
      });
    }
  };

  // Manual Cage Editor handlers
  const handleResizeGrid = (newSize) => {
    setSize(newSize);
    setCages([]);
    setGivens(createEmptyBoard(newSize));
    setBoardValues(createEmptyBoard(newSize));
    setEditorSelection([]);
    setSelectedCell([0, 0]);
    setLastOcrSummary(null);
    setPuzzleTitle(`Custom ${newSize}×${newSize}`);
    resetSolverState();
  };

  const handleStartDragSelect = ([r, c], shiftKey) => {
    setHighlightedCells([]);
    setIsDraggingSelect(true);
    setDragOriginCell([r, c]);
    setDragMoved(false);
    const key = cellKey(r, c);

    if (shiftKey) {
      setEditorSelection((prev) => {
        const exists = prev.some(([pr, pc]) => cellKey(pr, pc) === key);
        return exists
          ? prev.filter(([pr, pc]) => cellKey(pr, pc) !== key)
          : [...prev, [r, c]];
      });
      return;
    }

    const existingCage = cages.find((cage) =>
      cage.cells.some(([cr, cc]) => cr === r && cc === c)
    );
    if (existingCage) {
      setEditorSelection(existingCage.cells);
    } else {
      setEditorSelection([[r, c]]);
    }
  };

  const handleExtendDragSelect = ([r, c]) => {
    if (!isDraggingSelect || !dragOriginCell) return;
    const originKey = cellKey(dragOriginCell[0], dragOriginCell[1]);
    const key = cellKey(r, c);
    if (key === originKey) return;

    if (!dragMoved) {
      setDragMoved(true);
      setEditorSelection([dragOriginCell, [r, c]]);
      return;
    }

    setEditorSelection((prev) => {
      if (prev.some(([pr, pc]) => cellKey(pr, pc) === key)) return prev;
      return [...prev, [r, c]];
    });
  };

  const handleEndDragSelect = () => {
    setIsDraggingSelect(false);
    setDragOriginCell(null);
    setDragMoved(false);
  };

  const handleAssignCage = (cells, target, op) => {
    const selectedKeys = new Set(cells.map(([r, c]) => cellKey(r, c)));
    const newId = activeCageForEdit ? activeCageForEdit.id : `cage-${Date.now()}`;

    setCages((prev) => {
      const updated = [];
      for (const cage of prev) {
        if (activeCageForEdit && cage.id === activeCageForEdit.id) continue;
        const remaining = cage.cells.filter(([r, c]) => !selectedKeys.has(cellKey(r, c)));
        if (remaining.length > 0) {
          updated.push({
            ...cage,
            cells: remaining,
            op: remaining.length === 1 ? '=' : cage.op,
          });
        }
      }
      updated.push({ id: newId, cells: cells.slice(), target, op });
      return updated;
    });

    setEditorSelection([]);
    setHighlightedCells([]);
    resetSolverState();
  };

  const handleDeleteCage = (cageId) => {
    setCages((prev) => prev.filter((c) => c.id !== cageId));
    setEditorSelection([]);
    resetSolverState();
  };

  const handleAutoFillSingles = () => {
    const covered = new Set();
    for (const cage of cages) {
      for (const [r, c] of cage.cells) {
        covered.add(cellKey(r, c));
      }
    }
    const additions = [];
    let idx = 1;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!covered.has(cellKey(r, c))) {
          additions.push({
            id: `single-${Date.now()}-${idx++}`,
            cells: [[r, c]],
            op: '=',
            target: 1,
          });
        }
      }
    }
    if (additions.length > 0) {
      setCages((prev) => [...prev, ...additions]);
      resetSolverState();
    }
  };

  const handleClearAllCages = () => {
    setCages([]);
    setEditorSelection([]);
    setGivens(createEmptyBoard(size));
    setBoardValues(createEmptyBoard(size));
    resetSolverState();
  };

  // OCR import handler (always lands in editable state)
  const handleOcrImported = (ocrPuzzle) => {
    const nextSize = ocrPuzzle.size;
    const nextGivens = ocrPuzzle.givens || createEmptyBoard(nextSize);
    setSize(nextSize);
    setCages(ocrPuzzle.cages);
    setGivens(nextGivens);
    setBoardValues(nextGivens.map((row) => row.slice()));
    setEditorSelection([]);
    setSelectedCell([0, 0]);
    setPuzzleTitle(`Scanned ${nextSize}×${nextSize}`);
    setLastOcrSummary({
      size: nextSize,
      cageCount: ocrPuzzle.cages.length,
      warnings: ocrPuzzle.warnings || [],
      confidenceNote: ocrPuzzle.confidenceNote || '',
    });
    resetSolverState();
  };

  // Visualizer playback loop
  const visSteps = solveResult?.steps || [];
  useEffect(() => {
    if (!isVisPlaying || activeMode !== 'visualize' || visSteps.length === 0) return;
    if (visStepIdx >= visSteps.length - 1) {
      setIsVisPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setVisStepIdx((prev) => {
        if (prev >= visSteps.length - 1) {
          setIsVisPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, visSpeedMs);
    return () => clearInterval(timer);
  }, [isVisPlaying, activeMode, visSteps.length, visStepIdx, visSpeedMs]);

  const activeVisStep =
    activeMode === 'visualize' && visSteps.length > 0
      ? visSteps[Math.min(visStepIdx, visSteps.length - 1)]
      : null;

  const handleModeChange = (nextMode) => {
    setActiveMode(nextMode);
    setIsVisPlaying(false);
    if (nextMode === 'visualize' && !solveResult && validation.valid) {
      handleSolve(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Header
        activeMode={activeMode}
        onModeChange={handleModeChange}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left / Center Stage: Interactive KenKen Canvas */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {puzzleTitle}
              </h1>
              <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                {size}×{size} Grid · {cages.length} Cages ·{' '}
                {validation.valid ? 'Valid Partition' : `${validation.unassignedCells.length} Unassigned`}
              </div>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
              <KenKenGrid
                size={size}
                cages={cages}
                boardValues={boardValues}
                givens={givens}
                mode={activeMode}
                selectedCell={selectedCell}
                onSelectCell={(coord) => {
                  setSelectedCell(coord);
                  setHighlightedCells([]);
                }}
                editorSelection={editorSelection}
                onStartDragSelect={handleStartDragSelect}
                onExtendDragSelect={handleExtendDragSelect}
                onEndDragSelect={handleEndDragSelect}
                errorCells={highlightedCells}
                diffCells={diffCells}
                visualizerStep={activeVisStep}
                showCandidates={showCandidates}
                conflictMap={conflictMap}
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                {activeMode === 'play' && (
                  <span>
                    Use arrow keys &amp; digits 1–{size} to play, or click Solve Puzzle.
                  </span>
                )}
                {activeMode === 'create' && (
                  <span>
                    Drag cells to group a cage. Click an existing cage to modify its clue.
                  </span>
                )}
                {activeMode === 'ocr' && (
                  <span>
                    Uploaded puzzles load directly here for review and editing before solving.
                  </span>
                )}
                {activeMode === 'visualize' && (
                  <span>
                    Showing constraint propagation &amp; backtracking state at step{' '}
                    {visSteps.length > 0 ? visStepIdx + 1 : 0}.
                  </span>
                )}

                {activeMode === 'play' && conflictMap.size > 0 && (
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    Row, column, or cage rule conflict detected
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Right Control & Inspector Deck */}
          <aside className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 sm:p-6 shadow-xs">
            {activeMode === 'play' && (
              <PlaySolvePanel
                size={size}
                difficulty={difficulty}
                onChangeSizeAndGenerate={(n) => handleGenerate(n, difficulty)}
                onChangeDifficulty={(d) => {
                  setDifficulty(d);
                  handleGenerate(size, d);
                }}
                onGenerate={() => handleGenerate(size, difficulty)}
                onLoadPreset={handleLoadPreset}
                selectedCell={selectedCell}
                onInputDigit={handleInputDigit}
                onSolve={() => handleSolve(false)}
                onOpenVisualizer={() => handleSolve(true)}
                onHint={handleHint}
                onClearBoard={() => {
                  setBoardValues(givens.map((r) => r.slice()));
                  resetSolverState();
                }}
                onSwitchToEditor={() => setActiveMode('create')}
                solveResult={solveResult}
                activeSolutionIndex={activeSolutionIndex}
                onSelectSolutionIndex={handleSelectSolutionIndex}
                validation={validation}
                onHighlightCells={setHighlightedCells}
                userSolvedCorrectly={userSolvedCorrectly}
              />
            )}

            {activeMode === 'create' && (
              <CageEditorPanel
                size={size}
                onResizeGrid={handleResizeGrid}
                cages={cages}
                selectedCells={editorSelection}
                onClearSelection={() => setEditorSelection([])}
                onAssignCage={handleAssignCage}
                onDeleteCage={handleDeleteCage}
                onSelectCageCells={(cage) => setEditorSelection(cage.cells)}
                onAutoFillSingles={handleAutoFillSingles}
                onClearAllCages={handleClearAllCages}
                validation={validation}
                onHighlightCells={setHighlightedCells}
                onSolveFromEditor={() => {
                  setActiveMode('play');
                  handleSolve(false);
                }}
                activeCageForEdit={activeCageForEdit}
              />
            )}

            {activeMode === 'ocr' && (
              <ImageOcrPanel
                onOcrImported={handleOcrImported}
                onEditBeforeSolve={() => setActiveMode('create')}
                onSolveNow={() => {
                  setActiveMode('play');
                  handleSolve(false);
                }}
                validation={validation}
                lastOcrSummary={lastOcrSummary}
              />
            )}

            {activeMode === 'visualize' && (
              <VisualizerPanel
                steps={visSteps}
                currentStepIdx={visStepIdx}
                onSetStepIdx={(idx) => {
                  setIsVisPlaying(false);
                  setVisStepIdx(idx);
                }}
                isPlaying={isVisPlaying}
                onTogglePlay={() => {
                  if (visStepIdx >= visSteps.length - 1) {
                    setVisStepIdx(0);
                  }
                  setIsVisPlaying((p) => !p);
                }}
                speedMs={visSpeedMs}
                onChangeSpeed={setVisSpeedMs}
                showCandidates={showCandidates}
                onToggleCandidates={setShowCandidates}
                stepsTruncated={Boolean(solveResult?.stepsTruncated)}
                onRunTrace={() => handleSolve(true)}
              />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
