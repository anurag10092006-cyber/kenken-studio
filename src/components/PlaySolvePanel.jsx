import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  Lightbulb,
  Play,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DIFFICULTIES, MAX_GRID_SIZE, MIN_GRID_SIZE } from '../engine/kenkenConstants.js';
import { CURATED_PRESETS } from '../engine/kenkenGenerator.js';

export default function PlaySolvePanel({
  size,
  difficulty,
  onChangeSizeAndGenerate,
  onChangeDifficulty,
  onGenerate,
  onLoadPreset,
  selectedCell,
  onInputDigit,
  onSolve,
  onOpenVisualizer,
  onHint,
  onClearBoard,
  onSwitchToEditor,
  solveResult,
  activeSolutionIndex,
  onSelectSolutionIndex,
  validation,
  onHighlightCells,
  userSolvedCorrectly,
}) {
  const digits = Array.from({ length: size }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Puzzle Generator */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Puzzle Generator
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {size}×{size} · {difficulty}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="gen-size-select"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Grid Size
            </label>
            <select
              id="gen-size-select"
              value={size}
              onChange={(e) => onChangeSizeAndGenerate(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {Array.from(
                { length: MAX_GRID_SIZE - MIN_GRID_SIZE + 1 },
                (_, i) => MIN_GRID_SIZE + i
              ).map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="gen-diff-select"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Difficulty
            </label>
            <select
              id="gen-diff-select"
              value={difficulty}
              onChange={(e) => onChangeDifficulty(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Shuffle className="w-4 h-4" />
          <span>Generate Unique Puzzle</span>
        </button>

        {/* Curated Presets */}
        <div className="pt-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Sample Puzzles &amp; Edge Cases
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CURATED_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onLoadPreset(preset)}
                className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {preset.tag}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Digit Input Pad */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Number Pad
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {selectedCell
              ? `Selected R${selectedCell[0] + 1}C${selectedCell[1] + 1}`
              : 'Select a cell'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              disabled={!selectedCell}
              onClick={() => onInputDigit(d)}
              className="h-11 font-mono-num text-base font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={!selectedCell}
            onClick={() => onInputDigit(0)}
            className="h-11 inline-flex items-center justify-center gap-1.5 px-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Eraser className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
      </section>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Solver Actions */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Solver &amp; Verification
        </h2>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onSolve}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Solve Puzzle</span>
          </button>

          <button
            type="button"
            onClick={onOpenVisualizer}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>Visualize Steps</span>
          </button>

          <button
            type="button"
            onClick={onHint}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Hint (1 Cell)</span>
          </button>

          <button
            type="button"
            onClick={onClearBoard}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear Digits</span>
          </button>
        </div>

        {/* User manually completed puzzle correctly */}
        {userSolvedCorrectly && (
          <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Puzzle Solved Correctly</span>
            </div>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              All rows, columns, and arithmetic cages satisfy the puzzle constraints.
            </p>
          </div>
        )}

        {/* Validation Errors */}
        {validation && !validation.valid && (
          <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Invalid Puzzle Setup</span>
              </div>
              <button
                type="button"
                onClick={onSwitchToEditor}
                className="text-xs font-semibold underline hover:no-underline cursor-pointer"
              >
                Fix in Editor
              </button>
            </div>
            <ul className="space-y-1 text-xs">
              {validation.errors.slice(0, 4).map((err, idx) => (
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

        {/* Solver Result Diagnostics */}
        {solveResult && solveResult.status === 'unique' && (
          <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Unique Solution Verified</span>
              </div>
              <span className="text-xs font-mono-num text-emerald-800 dark:text-emerald-300">
                {solveResult.metrics.elapsedMs} ms
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
              {solveResult.metrics.propagations} propagations · {solveResult.metrics.hiddenSingles}{' '}
              hidden singles · {solveResult.metrics.backtracks} backtracks
            </div>
          </div>
        )}

        {solveResult && solveResult.status === 'multiple' && (
          <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/35 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Multiple Solutions Detected (2+)</span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              This puzzle is under-constrained. Highlighted cells differ between valid solutions.
            </p>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-amber-100/80 dark:bg-amber-900/40">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSolutionIndex(idx)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeSolutionIndex === idx
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-amber-900 dark:text-amber-200 hover:bg-white/50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  Solution {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {solveResult && solveResult.status === 'unsolvable' && (
          <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-200">
              <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Unsolvable Puzzle</span>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-300">
              No digit assignment satisfies all cage rules and Latin-square constraints simultaneously.
            </p>
            <button
              type="button"
              onClick={onOpenVisualizer}
              className="text-xs font-semibold text-rose-900 dark:text-rose-200 underline hover:no-underline cursor-pointer"
            >
              Inspect contradiction in Step Visualizer
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
