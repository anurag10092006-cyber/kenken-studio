import { useState, useEffect } from 'react';
import { CheckCircle2, Plus, Sparkles, Trash2, Wand2, XCircle } from 'lucide-react';
import {
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  OPERATORS,
  formatCageClue,
  isCageContiguous,
} from '../engine/kenkenConstants.js';

export default function CageEditorPanel({
  size,
  onResizeGrid,
  cages,
  selectedCells,
  onClearSelection,
  onAssignCage,
  onDeleteCage,
  onSelectCageCells,
  onAutoFillSingles,
  onClearAllCages,
  validation,
  onHighlightCells,
  onSolveFromEditor,
  activeCageForEdit,
}) {
  const [targetInput, setTargetInput] = useState('3');
  const [opInput, setOpInput] = useState('+');
  const [localError, setLocalError] = useState('');

  // Sync inputs when clicking an existing cage
  useEffect(() => {
    if (activeCageForEdit) {
      setTargetInput(String(activeCageForEdit.target));
      setOpInput(activeCageForEdit.op);
      setLocalError('');
    } else if (selectedCells.length === 1) {
      setOpInput('=');
    } else if (selectedCells.length > 2 && (opInput === '-' || opInput === '÷' || opInput === '=')) {
      setOpInput('+');
    } else if (selectedCells.length === 2 && opInput === '=') {
      setOpInput('+');
    }
  }, [activeCageForEdit, selectedCells.length]);

  const handleAssign = (e) => {
    e.preventDefault();
    setLocalError('');

    if (selectedCells.length === 0) {
      setLocalError('Drag or click cells on the grid to select a cage region first.');
      return;
    }

    if (!isCageContiguous(selectedCells)) {
      setLocalError('Selected cells must form a single connected orthogonal region.');
      return;
    }

    const parsedTarget = Number(targetInput);
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1) {
      setLocalError('Target must be a positive whole number.');
      return;
    }

    const effectiveOp = selectedCells.length === 1 ? '=' : opInput;
    if (selectedCells.length > 1 && effectiveOp === '=') {
      setLocalError('Multi-cell cages require +, -, ×, or ÷.');
      return;
    }
    if ((effectiveOp === '-' || effectiveOp === '÷') && selectedCells.length !== 2) {
      setLocalError(`Operator "${effectiveOp}" can only be used on 2-cell cages.`);
      return;
    }
    if (effectiveOp === '=' && (parsedTarget < 1 || parsedTarget > size)) {
      setLocalError(`Single-cell value must be between 1 and ${size}.`);
      return;
    }

    onAssignCage(selectedCells, parsedTarget, effectiveOp);
  };

  return (
    <div className="space-y-6">
      {/* Grid Dimension & Quick Actions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Manual Cage Builder
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {cages.length} cage{cages.length === 1 ? '' : 's'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Click or drag across cells on the grid to select a cage region, or hold Shift to toggle
          individual cells.
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label
              htmlFor="editor-size-select"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Grid Dimension
            </label>
            <select
              id="editor-size-select"
              value={size}
              onChange={(e) => onResizeGrid(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {Array.from(
                { length: MAX_GRID_SIZE - MIN_GRID_SIZE + 1 },
                (_, i) => MIN_GRID_SIZE + i
              ).map((n) => (
                <option key={n} value={n}>
                  {n} × {n} Grid
                </option>
              ))}
            </select>
          </div>

          <div className="pt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={onAutoFillSingles}
              title="Convert unassigned cells into single-value cages"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Fill Singles</span>
            </button>

            <button
              type="button"
              onClick={onClearAllCages}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Selected Region Form */}
      <form onSubmit={handleAssign} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {selectedCells.length > 0
              ? `${selectedCells.length} Cell${selectedCells.length === 1 ? '' : 's'} Selected`
              : 'No Cells Selected'}
          </span>
          {selectedCells.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="cage-target-input"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Target Number
            </label>
            <input
              id="cage-target-input"
              type="number"
              min="1"
              max="1000000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full px-3 py-2 font-mono-num text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Arithmetic Operator
            </span>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {OPERATORS.map((op) => {
                const disabled =
                  (selectedCells.length === 1 && op !== '=') ||
                  (selectedCells.length > 1 && op === '=') ||
                  (selectedCells.length > 2 && (op === '-' || op === '÷'));
                const active = opInput === op;
                return (
                  <button
                    key={op}
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpInput(op)}
                    className={`py-1.5 font-mono-num text-sm font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                      active
                        ? 'bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {op}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {localError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{localError}</p>
        )}

        <button
          type="submit"
          disabled={selectedCells.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{activeCageForEdit ? 'Update Selected Cage' : 'Assign Cage'}</span>
        </button>
      </form>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Live Validation Summary */}
      <section className="space-y-2.5">
        {validation?.valid ? (
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>All {size * size} cells valid &amp; partitioned</span>
            </div>
            <button
              type="button"
              onClick={onSolveFromEditor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Solve Now</span>
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <XCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Puzzle Incomplete ({validation?.errors?.length || 0} issue{validation?.errors?.length === 1 ? '' : 's'})</span>
            </div>
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {validation?.errors?.slice(0, 3).map((err, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => err.cells && onHighlightCells(err.cells)}
                    className="text-left hover:underline cursor-pointer"
                  >
                    • {err.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Cage List */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Defined Cages ({cages.length})
        </h3>
        {cages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
            No cages defined yet. Drag across cells on the board to create your first cage.
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {cages.map((cage) => (
              <div
                key={cage.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <button
                  type="button"
                  onClick={() => onSelectCageCells(cage)}
                  className="flex-1 text-left flex items-center gap-2.5 cursor-pointer"
                >
                  <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100 min-w-[44px]">
                    {formatCageClue(cage.target, cage.op)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate font-mono-num">
                    {cage.cells.map(([r, c]) => `R${r + 1}C${c + 1}`).join(' ')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCage(cage.id)}
                  aria-label={`Delete cage ${formatCageClue(cage.target, cage.op)}`}
                  className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
