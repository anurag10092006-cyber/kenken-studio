import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';

const STEP_LABELS = {
  init: 'Initialization',
  cage_prune: 'Cage Arc Consistency',
  peer_prune: 'Row/Col Elimination',
  hidden_single: 'Hidden Single',
  branch: 'MRV Branching',
  conflict: 'Contradiction',
  backtrack: 'Backtrack',
  solution: 'Solution',
  unsolvable: 'Unsolvable',
};

export default function VisualizerPanel({
  steps,
  currentStepIdx,
  onSetStepIdx,
  isPlaying,
  onTogglePlay,
  speedMs,
  onChangeSpeed,
  showCandidates,
  onToggleCandidates,
  stepsTruncated,
  onRunTrace,
}) {
  const total = steps.length;
  const currentStep = total > 0 ? steps[Math.min(currentStepIdx, total - 1)] : null;

  if (total === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Algorithm Step Visualizer
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Inspect how constraint propagation (cage arc consistency, row/column elimination, hidden
          singles) and MRV backtracking solve the current puzzle step by step.
        </p>
        <button
          type="button"
          onClick={onRunTrace}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4" />
          <span>Run Solver &amp; Record Trace</span>
        </button>
      </div>
    );
  }

  const typeTone =
    currentStep?.type === 'conflict' || currentStep?.type === 'backtrack' || currentStep?.type === 'unsolvable'
      ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
      : currentStep?.type === 'branch'
        ? 'border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
        : currentStep?.type === 'solution'
          ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
          : 'border-blue-200 dark:border-blue-900/70 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-slate-100';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Algorithm Trace
        </h2>
        <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
          Step {currentStepIdx + 1} / {total}
        </span>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSetStepIdx(0)}
          aria-label="Reset to first step"
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={currentStepIdx <= 0}
          onClick={() => onSetStepIdx(Math.max(0, currentStepIdx - 1))}
          aria-label="Previous step"
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isPlaying ? 'Pause' : 'Play Trace'}</span>
        </button>

        <button
          type="button"
          disabled={currentStepIdx >= total - 1}
          onClick={() => onSetStepIdx(Math.min(total - 1, currentStepIdx + 1))}
          aria-label="Next step"
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => onSetStepIdx(total - 1)}
          aria-label="Jump to final step"
          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Scrubber */}
      <div className="space-y-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={currentStepIdx}
          onChange={(e) => onSetStepIdx(Number(e.target.value))}
          aria-label="Solver timeline scrubber"
          className="w-full accent-blue-600 cursor-pointer"
        />

        <div className="flex items-center justify-between gap-3 text-xs">
          <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showCandidates}
              onChange={(e) => onToggleCandidates(e.target.checked)}
              className="rounded accent-blue-600"
            />
            <span>Show Candidate Pencil Marks</span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400">Speed</span>
            <select
              value={speedMs}
              onChange={(e) => onChangeSpeed(Number(e.target.value))}
              aria-label="Playback speed"
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono-num"
            >
              <option value={750}>1×</option>
              <option value={380}>2×</option>
              <option value={150}>5×</option>
              <option value={60}>12×</option>
            </select>
          </div>
        </div>
      </div>

      {/* Current Step Explanation Card */}
      {currentStep && (
        <div className={`p-3.5 rounded-xl border space-y-1.5 ${typeTone}`}>
          <div className="flex items-center justify-between gap-2 text-xs font-mono-num opacity-85">
            <span>{STEP_LABELS[currentStep.type] || currentStep.type}</span>
            <span>
              Depth {currentStep.depth} · Backtracks {currentStep.backtracks}
            </span>
          </div>
          <div className="text-sm font-semibold">{currentStep.title}</div>
          <p className="text-xs leading-relaxed opacity-90">{currentStep.description}</p>
        </div>
      )}

      {stepsTruncated && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Trace capped at {total} snapshots for responsiveness; solver still ran to full completion.
        </p>
      )}

      {/* Step History Log */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Execution Timeline
        </h3>
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {steps.map((step, idx) => {
            const active = idx === currentStepIdx;
            return (
              <button
                key={step.index}
                type="button"
                onClick={() => onSetStepIdx(idx)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-start gap-2.5 ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 font-medium'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500 min-w-[28px]">
                  #{idx + 1}
                </span>
                <span className="truncate flex-1">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
