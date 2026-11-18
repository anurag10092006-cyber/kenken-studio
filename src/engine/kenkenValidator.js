import {
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  OPERATORS,
  cellKey,
  isCageContiguous,
  normalizeOperator,
} from './kenkenConstants.js';

/**
 * Validates a KenKen puzzle definition for structural and arithmetic legality.
 * Checks grid bounds, complete non-overlapping cage partition, cage contiguity,
 * valid operators/targets, and any optional pre-filled clue digits.
 *
 * @param {Object} puzzle
 * @param {number} puzzle.size
 * @param {Array<{id: string, cells: Array<number[]>, target: number, op: string}>} puzzle.cages
 * @param {Array<Array<number>>} [puzzle.givens] - Optional pre-filled digits (0 = empty)
 * @returns {{
 *   valid: boolean,
 *   errors: Array<{code: string, message: string, cageId?: string, cells?: Array<number[]>}>,
 *   warnings: Array<{code: string, message: string, cageId?: string, cells?: Array<number[]>}>,
 *   unassignedCells: Array<number[]>,
 *   duplicateCells: Array<number[]>
 * }}
 */
export function validatePuzzle(puzzle) {
  const errors = [];
  const warnings = [];
  const unassignedCells = [];
  const duplicateCells = [];

  if (!puzzle || typeof puzzle !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'MISSING_PUZZLE', message: 'Puzzle object is missing.' }],
      warnings: [],
      unassignedCells: [],
      duplicateCells: [],
    };
  }

  const size = Number(puzzle.size);
  if (!Number.isInteger(size) || size < MIN_GRID_SIZE || size > MAX_GRID_SIZE) {
    errors.push({
      code: 'INVALID_SIZE',
      message: `Grid size must be an integer between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}.`,
    });
    return { valid: false, errors, warnings, unassignedCells, duplicateCells };
  }

  const cages = Array.isArray(puzzle.cages) ? puzzle.cages : [];
  const cellOwnerCount = new Map();
  const seenCellInCage = new Set();

  for (const cage of cages) {
    const cageId = cage?.id ?? 'unknown';
    const cells = Array.isArray(cage?.cells) ? cage.cells : [];

    if (cells.length === 0) {
      errors.push({
        code: 'EMPTY_CAGE',
        message: `Cage "${cageId}" has no cells.`,
        cageId,
      });
      continue;
    }

    let outOfBounds = false;
    const localSet = new Set();

    for (const coord of cells) {
      if (
        !Array.isArray(coord) ||
        coord.length !== 2 ||
        !Number.isInteger(coord[0]) ||
        !Number.isInteger(coord[1]) ||
        coord[0] < 0 ||
        coord[0] >= size ||
        coord[1] < 0 ||
        coord[1] >= size
      ) {
        outOfBounds = true;
        continue;
      }

      const key = cellKey(coord[0], coord[1]);
      if (localSet.has(key)) {
        errors.push({
          code: 'DUPLICATE_CELL_IN_CAGE',
          message: `Cage "${cageId}" lists cell (${coord[0] + 1}, ${coord[1] + 1}) more than once.`,
          cageId,
          cells: [coord],
        });
      } else {
        localSet.add(key);
        cellOwnerCount.set(key, (cellOwnerCount.get(key) || 0) + 1);
        seenCellInCage.add(key);
      }
    }

    if (outOfBounds) {
      errors.push({
        code: 'CELL_OUT_OF_BOUNDS',
        message: `Cage "${cageId}" contains coordinates outside the ${size}×${size} grid.`,
        cageId,
        cells,
      });
      continue;
    }

    if (!isCageContiguous(cells)) {
      errors.push({
        code: 'NON_CONTIGUOUS_CAGE',
        message: `Cage "${cageId}" cells must be orthogonally connected.`,
        cageId,
        cells,
      });
    }

    const op = normalizeOperator(cage.op);
    if (!OPERATORS.includes(op)) {
      errors.push({
        code: 'INVALID_OPERATOR',
        message: `Cage "${cageId}" uses unsupported operator "${cage.op}".`,
        cageId,
        cells,
      });
    }

    const target = Number(cage.target);
    if (!Number.isInteger(target) || target < 1) {
      errors.push({
        code: 'INVALID_TARGET',
        message: `Cage "${cageId}" must have a positive integer target.`,
        cageId,
        cells,
      });
      continue;
    }

    // Operator-specific arity and feasibility checks
    if (cells.length === 1) {
      if (op !== '=') {
        errors.push({
          code: 'SINGLE_CELL_OP',
          message: `Single-cell cage at (${cells[0][0] + 1}, ${cells[0][1] + 1}) must use "=" (fixed value).`,
          cageId,
          cells,
        });
      }
      if (target < 1 || target > size) {
        errors.push({
          code: 'SINGLE_CELL_RANGE',
          message: `Single-cell target ${target} at (${cells[0][0] + 1}, ${cells[0][1] + 1}) must be between 1 and ${size}.`,
          cageId,
          cells,
        });
      }
    } else {
      if (op === '=') {
        errors.push({
          code: 'MULTI_CELL_EQUALS',
          message: `Multi-cell cage "${cageId}" cannot use "="; choose +, -, ×, or ÷.`,
          cageId,
          cells,
        });
      }

      if ((op === '-' || op === '÷') && cells.length !== 2) {
        errors.push({
          code: 'BINARY_OP_SIZE',
          message: `Cage "${cageId}" with "${op}" must contain exactly 2 cells (currently ${cells.length}).`,
          cageId,
          cells,
        });
      }

      if (op === '-' && cells.length === 2) {
        if (target < 1 || target >= size) {
          errors.push({
            code: 'SUBTRACTION_RANGE',
            message: `Subtraction target ${target} in cage "${cageId}" is impossible for ${size}×${size} (max difference is ${size - 1}).`,
            cageId,
            cells,
          });
        }
      }

      if (op === '÷' && cells.length === 2) {
        if (target < 2 || target > size) {
          errors.push({
            code: 'DIVISION_RANGE',
            message: `Division target ${target} in cage "${cageId}" must be between 2 and ${size} for adjacent distinct cells.`,
            cageId,
            cells,
          });
        }
      }

      if (op === '+') {
        const minSum = cells.length;
        const maxSum = cells.length * size;
        if (target < minSum || target > maxSum) {
          errors.push({
            code: 'ADDITION_RANGE',
            message: `Sum target ${target} in ${cells.length}-cell cage "${cageId}" is outside possible bounds [${minSum}, ${maxSum}].`,
            cageId,
            cells,
          });
        }
      }

      if (op === '×') {
        const maxProd = Math.pow(size, cells.length);
        if (target > maxProd) {
          errors.push({
            code: 'MULTIPLICATION_RANGE',
            message: `Product target ${target} in ${cells.length}-cell cage "${cageId}" exceeds maximum possible product ${maxProd}.`,
            cageId,
            cells,
          });
        }
      }
    }
  }

  // Check full grid coverage and overlaps
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = cellKey(r, c);
      const count = cellOwnerCount.get(key) || 0;
      if (count === 0) {
        unassignedCells.push([r, c]);
      } else if (count > 1) {
        duplicateCells.push([r, c]);
      }
    }
  }

  if (unassignedCells.length > 0) {
    errors.push({
      code: 'UNASSIGNED_CELLS',
      message: `${unassignedCells.length} cell${unassignedCells.length === 1 ? '' : 's'} ${unassignedCells.length === 1 ? 'is' : 'are'} not assigned to any cage.`,
      cells: unassignedCells,
    });
  }

  if (duplicateCells.length > 0) {
    errors.push({
      code: 'OVERLAPPING_CAGES',
      message: `${duplicateCells.length} cell${duplicateCells.length === 1 ? '' : 's'} belong to multiple cages.`,
      cells: duplicateCells,
    });
  }

  // Validate optional fixed givens if provided
  if (Array.isArray(puzzle.givens) && puzzle.givens.length === size) {
    for (let r = 0; r < size; r++) {
      const rowSeen = new Set();
      for (let c = 0; c < size; c++) {
        const val = puzzle.givens[r]?.[c] || 0;
        if (val !== 0) {
          if (!Number.isInteger(val) || val < 1 || val > size) {
            errors.push({
              code: 'INVALID_GIVEN',
              message: `Pre-filled digit ${val} at (${r + 1}, ${c + 1}) is out of range 1..${size}.`,
              cells: [[r, c]],
            });
          } else if (rowSeen.has(val)) {
            errors.push({
              code: 'GIVEN_ROW_CONFLICT',
              message: `Duplicate pre-filled digit ${val} in row ${r + 1}.`,
              cells: [[r, c]],
            });
          }
          rowSeen.add(val);
        }
      }
    }
    for (let c = 0; c < size; c++) {
      const colSeen = new Set();
      for (let r = 0; r < size; r++) {
        const val = puzzle.givens[r]?.[c] || 0;
        if (val !== 0) {
          if (colSeen.has(val)) {
            errors.push({
              code: 'GIVEN_COL_CONFLICT',
              message: `Duplicate pre-filled digit ${val} in column ${c + 1}.`,
              cells: [[r, c]],
            });
          }
          colSeen.add(val);
        }
      }
    }
  }

  if (cages.length === size * size && size >= 4) {
    warnings.push({
      code: 'TRIVIAL_CAGES',
      message: 'Every cell is a single-value cage; puzzle is already fully specified.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unassignedCells,
    duplicateCells,
  };
}
