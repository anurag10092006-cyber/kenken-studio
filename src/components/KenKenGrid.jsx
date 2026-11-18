import { useMemo } from 'react';
import { cellKey, formatCageClue, getTopLeftCell } from '../engine/kenkenConstants.js';

/**
 * Interactive KenKen Grid supporting sizes 3×3 through 9×9.
 * Handles:
 *  - Thick dynamic cage boundaries vs subtle intra-cage dividers
 *  - Play mode digit entry, keyboard navigation, and conflict feedback
 *  - Create/Edit mode drag-selection & cage highlighting
 *  - Visualize mode candidate domain micro-grids and step focus highlights
 */
export default function KenKenGrid({
  size,
  cages,
  boardValues,
  givens,
  mode,
  selectedCell,
  onSelectCell,
  editorSelection,
  onStartDragSelect,
  onExtendDragSelect,
  onEndDragSelect,
  onInspectCage,
  errorCells = [],
  diffCells = [],
  visualizerStep = null,
  showCandidates = false,
  conflictMap = null,
}) {
  // Build fast lookup maps for cage membership, clue labels, and highlights
  const { cellToCage, clueLabelMap } = useMemo(() => {
    const map = new Map();
    const clues = new Map();
    for (const cage of cages) {
      for (const [r, c] of cage.cells) {
        map.set(cellKey(r, c), cage);
      }
      const tl = getTopLeftCell(cage.cells);
      if (tl) {
        clues.set(cellKey(tl[0], tl[1]), formatCageClue(cage.target, cage.op));
      }
    }
    return { cellToCage: map, clueLabelMap: clues };
  }, [cages]);

  const editorSet = useMemo(
    () => new Set((editorSelection || []).map(([r, c]) => cellKey(r, c))),
    [editorSelection]
  );

  const errorSet = useMemo(
    () => new Set((errorCells || []).map(([r, c]) => cellKey(r, c))),
    [errorCells]
  );

  const diffSet = useMemo(
    () => new Set((diffCells || []).map(([r, c]) => cellKey(r, c))),
    [diffCells]
  );

  const focusSet = useMemo(
    () => new Set((visualizerStep?.focusCells || []).map(([r, c]) => cellKey(r, c))),
    [visualizerStep]
  );

  const activeBoard = visualizerStep ? visualizerStep.board : boardValues;
  const activeDomains = visualizerStep ? visualizerStep.domains : null;

  const isDense = size >= 8;
  const isMediumDense = size >= 6 && size < 8;

  const digitTextClass =
    size <= 4
      ? 'text-2xl sm:text-3xl'
      : size <= 6
        ? 'text-xl sm:text-2xl'
        : size <= 7
          ? 'text-lg sm:text-xl'
          : 'text-base sm:text-lg';

  const clueTextClass =
    size <= 5
      ? 'text-[11px] sm:text-xs'
      : size <= 7
        ? 'text-[10px] sm:text-[11px]'
        : 'text-[9px] sm:text-[10px]';

  const candidateCols = size <= 4 ? 2 : 3;

  return (
    <div
      className="w-full max-w-[600px] mx-auto select-none"
      onPointerUp={() => onEndDragSelect?.()}
      onPointerLeave={() => onEndDragSelect?.()}
    >
      <div
        role="grid"
        aria-label={`${size} by ${size} KenKen puzzle grid`}
        className="grid w-full aspect-square bg-white dark:bg-slate-900 border-[3px] border-slate-900 dark:border-slate-200 rounded-md overflow-hidden shadow-sm"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => {
            const key = cellKey(r, c);
            const cage = cellToCage.get(key);
            const cageId = cage?.id || null;
            const clueText = clueLabelMap.get(key) || '';
            const val = activeBoard?.[r]?.[c] || 0;
            const isGiven = Boolean(givens?.[r]?.[c]);
            const candidates = activeDomains?.[r]?.[c] || [];

            // Compare neighbor cageIds for crisp cage borders
            const topSame = r > 0 && cellToCage.get(cellKey(r - 1, c))?.id === cageId && cageId !== null;
            const leftSame = c > 0 && cellToCage.get(cellKey(r, c - 1))?.id === cageId && cageId !== null;
            const rightSame =
              c < size - 1 && cellToCage.get(cellKey(r, c + 1))?.id === cageId && cageId !== null;
            const bottomSame =
              r < size - 1 && cellToCage.get(cellKey(r + 1, c))?.id === cageId && cageId !== null;

            const isSelected =
              mode !== 'create' && selectedCell && selectedCell[0] === r && selectedCell[1] === c;
            const isEditorSelected = mode === 'create' && editorSet.has(key);
            const isError = errorSet.has(key) || Boolean(conflictMap?.has(key));
            const isDiff = diffSet.has(key);
            const isVisFocus = mode === 'visualize' && focusSet.has(key);
            const isUnassigned = !cageId;

            // Surface priority
            let cellBg = 'bg-white dark:bg-slate-900';
            if (isUnassigned) {
              cellBg = 'bg-slate-100/90 dark:bg-slate-800/70';
            }
            if (isDiff) {
              cellBg = 'bg-amber-50 dark:bg-amber-950/50';
            }
            if (isError) {
              cellBg = 'bg-rose-50 dark:bg-rose-950/50';
            }
            if (isVisFocus) {
              if (visualizerStep?.type === 'conflict' || visualizerStep?.type === 'backtrack') {
                cellBg = 'bg-rose-100/80 dark:bg-rose-900/40';
              } else if (visualizerStep?.type === 'branch') {
                cellBg = 'bg-amber-100/80 dark:bg-amber-900/40';
              } else if (visualizerStep?.type === 'solution') {
                cellBg = 'bg-emerald-100/80 dark:bg-emerald-900/40';
              } else {
                cellBg = 'bg-blue-50 dark:bg-blue-950/60';
              }
            }
            if (isEditorSelected) {
              cellBg = 'bg-blue-100/90 dark:bg-blue-900/55';
            } else if (isSelected) {
              cellBg = 'bg-blue-50 dark:bg-blue-950/70';
            }

            const borderStyles = {
              borderTopWidth: r === 0 ? '0px' : topSame ? '1px' : '2.5px',
              borderLeftWidth: c === 0 ? '0px' : leftSame ? '1px' : '2.5px',
              borderRightWidth: c === size - 1 ? '0px' : rightSame ? '0px' : '0px',
              borderBottomWidth: r === size - 1 ? '0px' : bottomSame ? '0px' : '0px',
            };

            const borderClasses = [
              r > 0 && (topSame ? 'border-t-slate-200 dark:border-t-slate-700/70' : 'border-t-slate-900 dark:border-t-slate-200'),
              c > 0 && (leftSame ? 'border-l-slate-200 dark:border-l-slate-700/70' : 'border-l-slate-900 dark:border-l-slate-200'),
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-label={`Row ${r + 1} Column ${c + 1}${clueText ? `, cage ${clueText}` : ''}${val ? `, value ${val}` : ''}`}
                style={borderStyles}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (mode === 'create') {
                    onStartDragSelect?.([r, c], e.shiftKey);
                  } else {
                    onSelectCell?.([r, c]);
                    if (cage && onInspectCage) {
                      onInspectCage(cage);
                    }
                  }
                }}
                onPointerEnter={() => {
                  if (mode === 'create') {
                    onExtendDragSelect?.([r, c]);
                  }
                }}
                className={`relative flex items-center justify-center border-solid transition-colors duration-100 cursor-pointer focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 ${cellBg} ${borderClasses}`}
              >
                {/* Cage clue in top-left corner */}
                {clueText && (
                  <span
                    className={`absolute top-0.5 left-1 font-mono-num font-semibold leading-none tracking-tight pointer-events-none ${clueTextClass} ${
                      isError
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {clueText}
                  </span>
                )}

                {/* Unassigned cell dot indicator in Create mode */}
                {isUnassigned && mode === 'create' && !isEditorSelected && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"
                  />
                )}

                {/* Main digit */}
                {val > 0 ? (
                  <span
                    className={`font-mono-num leading-none ${digitTextClass} ${
                      isError
                        ? 'font-bold text-rose-600 dark:text-rose-400'
                        : isGiven
                          ? 'font-bold text-slate-900 dark:text-white'
                          : mode === 'visualize'
                            ? 'font-bold text-blue-700 dark:text-blue-300'
                            : 'font-semibold text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {val}
                  </span>
                ) : mode === 'visualize' && showCandidates && candidates.length > 0 ? (
                  <div
                    className={`grid gap-px pt-3 px-0.5 w-full h-full place-items-center pointer-events-none ${
                      isDense ? 'text-[8px]' : isMediumDense ? 'text-[9px]' : 'text-[10px]'
                    } font-mono-num text-slate-500 dark:text-slate-400`}
                    style={{
                      gridTemplateColumns: `repeat(${candidateCols}, minmax(0, 1fr))`,
                    }}
                  >
                    {candidates.map((d) => (
                      <span key={d} className="leading-none">
                        {d}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Selected cell inner ring */}
                {(isSelected || isEditorSelected) && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-blue-600 dark:ring-blue-400"
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
