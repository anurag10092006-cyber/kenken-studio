/**
 * Shared constants, operator normalization, and geometric helpers for KenKen grids.
 * Pure JavaScript module — completely independent of React or browser DOM APIs.
 */

export const MIN_GRID_SIZE = 3;
export const MAX_GRID_SIZE = 9;

export const OPERATORS = ['+', '-', '×', '÷', '='];

export const OPERATOR_LABELS = {
  '+': 'Addition (+)',
  '-': 'Subtraction (−)',
  '×': 'Multiplication (×)',
  '÷': 'Division (÷)',
  '=': 'Single Value (=)',
};

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', description: 'Smaller cages, direct propagation' },
  { id: 'medium', label: 'Medium', description: 'Mixed operators, light lookahead' },
  { id: 'hard', label: 'Hard', description: 'Larger cages, deeper deduction' },
  { id: 'expert', label: 'Expert', description: 'Minimal singles, heavy branching' },
];

/**
 * Normalizes operator characters from OCR or user input into canonical KenKen symbols.
 * @param {string} rawOp
 * @returns {string}
 */
export function normalizeOperator(rawOp) {
  if (!rawOp) return '=';
  const trimmed = String(rawOp).trim();
  if (trimmed === '+' || trimmed === 'add') return '+';
  if (trimmed === '-' || trimmed === '−' || trimmed === '–' || trimmed === 'sub') return '-';
  if (trimmed === '×' || trimmed === '*' || trimmed === 'x' || trimmed === 'X' || trimmed === 'mul') return '×';
  if (trimmed === '÷' || trimmed === '/' || trimmed === 'div') return '÷';
  if (trimmed === '=' || trimmed === '') return '=';
  return trimmed;
}

/**
 * Produces a stable string key for a grid coordinate.
 * @param {number} r
 * @param {number} c
 * @returns {string}
 */
export function cellKey(r, c) {
  return `${r},${c}`;
}

/**
 * Checks whether two [r, c] cells share a horizontal or vertical edge.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
export function areOrthogonallyAdjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

/**
 * Checks whether a list of [r, c] cells forms a single orthogonally connected polyomino.
 * @param {Array<number[]>} cells
 * @returns {boolean}
 */
export function isCageContiguous(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  if (cells.length === 1) return true;

  const keySet = new Set(cells.map(([r, c]) => cellKey(r, c)));
  const visited = new Set();
  const queue = [cells[0]];
  visited.add(cellKey(cells[0][0], cells[0][1]));

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const neighbors = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      const k = cellKey(nr, nc);
      if (keySet.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size === keySet.size;
}

/**
 * Returns the canonical top-left-most cell in a cage (smallest row, then smallest col),
 * which is where the cage's clue label is rendered.
 * @param {Array<number[]>} cells
 * @returns {number[] | null}
 */
export function getTopLeftCell(cells) {
  if (!Array.isArray(cells) || cells.length === 0) return null;
  let best = cells[0];
  for (let i = 1; i < cells.length; i++) {
    const [r, c] = cells[i];
    if (r < best[0] || (r === best[0] && c < best[1])) {
      best = [r, c];
    }
  }
  return best;
}

/**
 * Formats a cage clue string (e.g., "12×" or "3" for single-cell "=" cages).
 * @param {number} target
 * @param {string} op
 * @returns {string}
 */
export function formatCageClue(target, op) {
  const norm = normalizeOperator(op);
  if (norm === '=') return `${target}`;
  return `${target}${norm}`;
}
