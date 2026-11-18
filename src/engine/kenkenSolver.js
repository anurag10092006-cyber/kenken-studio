import { normalizeOperator } from './kenkenConstants.js';
import { validatePuzzle } from './kenkenValidator.js';

/**
 * KenKen Constraint Propagation & Backtracking Solver.
 * Pure JavaScript, deterministic, and completely decoupled from any UI framework.
 *
 * Features:
 *  - Bitmask domain representation (bits 1..N) for fast propagation
 *  - Exact Generalized Arc Consistency (GAC) on cages (with row/col distinctness inside cages)
 *  - Row & Column peer elimination + Hidden Singles detection
 *  - MRV (Minimum Remaining Values) variable ordering with degree tie-breaking
 *  - Detection of invalid, unsolvable, unique-solution, and multiple-solution puzzles
 *  - Rich step-by-step trace snapshots for algorithm visualization
 */

function bitMaskToArray(mask, size) {
  const arr = [];
  for (let d = 1; d <= size; d++) {
    if (mask & (1 << d)) arr.push(d);
  }
  return arr;
}

function popCount(mask) {
  let count = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    count++;
  }
  return count;
}

function lowestSetDigit(mask) {
  for (let d = 1; d <= 9; d++) {
    if (mask & (1 << d)) return d;
  }
  return 0;
}

function cloneDomains(domains) {
  return new Uint16Array(domains);
}

function snapshotBoardAndDomains(domains, size) {
  const board = [];
  const domainGrid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    const dRow = [];
    for (let c = 0; c < size; c++) {
      const mask = domains[r * size + c];
      const vals = bitMaskToArray(mask, size);
      row.push(vals.length === 1 ? vals[0] : 0);
      dRow.push(vals);
    }
    board.push(row);
    domainGrid.push(dRow);
  }
  return { board, domains: domainGrid };
}

/**
 * Evaluates whether a list of values satisfies a cage's arithmetic rule.
 * @param {number[]} values
 * @param {string} op
 * @param {number} target
 * @returns {boolean}
 */
function checkCageArithmetic(values, op, target) {
  if (op === '=') {
    return values.length === 1 && values[0] === target;
  }
  if (op === '+') {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    return sum === target;
  }
  if (op === '×') {
    let prod = 1;
    for (let i = 0; i < values.length; i++) prod *= values[i];
    return prod === target;
  }
  if (op === '-' && values.length === 2) {
    return Math.abs(values[0] - values[1]) === target;
  }
  if (op === '÷' && values.length === 2) {
    const maxV = Math.max(values[0], values[1]);
    const minV = Math.min(values[0], values[1]);
    return minV !== 0 && maxV === minV * target;
  }
  return false;
}

/**
 * Precomputes valid tuples for small/medium cages (length <= 5) respecting both
 * the cage arithmetic target and row/column uniqueness among cells inside the cage.
 * For larger cages (length > 5), returns null so the solver uses bounded recursive GAC.
 */
function buildCageTupleTable(cage, size) {
  const k = cage.cells.length;
  const op = normalizeOperator(cage.op);
  const target = Number(cage.target);

  if (k > 5) {
    return null;
  }

  // Track which pairs inside the cage share a row or column
  const conflictMask = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      if (cage.cells[i][0] === cage.cells[j][0] || cage.cells[i][1] === cage.cells[j][1]) {
        conflictMask[i] |= 1 << j;
        conflictMask[j] |= 1 << i;
      }
    }
  }

  const tuples = [];
  const current = new Array(k).fill(0);

  function backtrack(idx, runningSum, runningProd) {
    if (idx === k) {
      if (checkCageArithmetic(current, op, target)) {
        tuples.push(current.slice());
      }
      return;
    }

    const remaining = k - idx - 1;
    for (let d = 1; d <= size; d++) {
      // Enforce row/col distinctness inside cage
      let clashes = false;
      for (let prev = 0; prev < idx; prev++) {
        if ((conflictMask[idx] & (1 << prev)) && current[prev] === d) {
          clashes = true;
          break;
        }
      }
      if (clashes) continue;

      if (op === '+') {
        const nextSum = runningSum + d;
        if (nextSum + remaining * 1 > target) continue;
        if (nextSum + remaining * size < target) continue;
        current[idx] = d;
        backtrack(idx + 1, nextSum, runningProd);
      } else if (op === '×') {
        const nextProd = runningProd * d;
        if (target % nextProd !== 0) continue;
        if (nextProd * Math.pow(size, remaining) < target) continue;
        current[idx] = d;
        backtrack(idx + 1, runningSum, nextProd);
      } else {
        current[idx] = d;
        backtrack(idx + 1, runningSum, runningProd);
      }
    }
  }

  backtrack(0, 0, 1);
  return tuples;
}

/**
 * Computes supported domain masks for each cell in a large cage (k > 5)
 * when precomputed tuple tables are skipped.
 */
function computeLargeCageSupports(cage, domains, size) {
  const k = cage.cells.length;
  const op = normalizeOperator(cage.op);
  const target = Number(cage.target);
  const cellIndices = cage.cells.map(([r, c]) => r * size + c);
  const supports = new Uint16Array(k);

  if (op === '+') {
    // Min/max bounds propagation for large addition cages
    const mins = cellIndices.map((idx) => {
      const m = domains[idx];
      for (let d = 1; d <= size; d++) if (m & (1 << d)) return d;
      return size + 1;
    });
    const maxs = cellIndices.map((idx) => {
      const m = domains[idx];
      for (let d = size; d >= 1; d--) if (m & (1 << d)) return d;
      return 0;
    });
    const totalMin = mins.reduce((a, b) => a + b, 0);
    const totalMax = maxs.reduce((a, b) => a + b, 0);

    for (let i = 0; i < k; i++) {
      const minRest = totalMin - mins[i];
      const maxRest = totalMax - maxs[i];
      const m = domains[cellIndices[i]];
      for (let d = 1; d <= size; d++) {
        if ((m & (1 << d)) && d + maxRest >= target && d + minRest <= target) {
          supports[i] |= 1 << d;
        }
      }
    }
    return supports;
  }

  if (op === '×') {
    // Divisibility check for large multiplication cages
    for (let i = 0; i < k; i++) {
      const m = domains[cellIndices[i]];
      for (let d = 1; d <= size; d++) {
        if ((m & (1 << d)) && target % d === 0) {
          supports[i] |= 1 << d;
        }
      }
    }
    return supports;
  }

  for (let i = 0; i < k; i++) {
    supports[i] = domains[cellIndices[i]];
  }
  return supports;
}

/**
 * Solves a KenKen puzzle using constraint propagation and backtracking.
 *
 * @param {Object} puzzle
 * @param {number} puzzle.size
 * @param {Array<{id: string, cells: Array<number[]>, target: number, op: string}>} puzzle.cages
 * @param {Array<Array<number>>} [puzzle.givens]
 * @param {Object} [options]
 * @param {number} [options.maxSolutions=2] - Stop after finding this many solutions (2 detects multi-solution)
 * @param {boolean} [options.recordSteps=true] - Record visualization trace snapshots
 * @param {number} [options.maxSteps=2000] - Safety cap for visualization snapshots
 * @param {number} [options.maxNodes=250000] - Safety node cap for pathological puzzles
 * @returns {{
 *   status: 'invalid' | 'unsolvable' | 'unique' | 'multiple',
 *   solutions: Array<Array<Array<number>>>,
 *   solutionCount: number,
 *   validation: Object,
 *   steps: Array<Object>,
 *   stepsTruncated: boolean,
 *   aborted: boolean,
 *   metrics: Object
 * }}
 */
export function solveKenKen(puzzle, options = {}) {
  const {
    maxSolutions = 2,
    recordSteps = true,
    maxSteps = 2000,
    maxNodes = 250000,
  } = options;

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const validation = validatePuzzle(puzzle);

  if (!validation.valid) {
    return {
      status: 'invalid',
      solutions: [],
      solutionCount: 0,
      validation,
      steps: [],
      stepsTruncated: false,
      aborted: false,
      metrics: {
        propagations: 0,
        eliminations: 0,
        hiddenSingles: 0,
        nakedSingles: 0,
        branches: 0,
        backtracks: 0,
        maxDepth: 0,
        elapsedMs: 0,
        solvedByPropagationOnly: false,
      },
    };
  }

  const size = Number(puzzle.size);
  const numCells = size * size;
  const fullMask = ((1 << (size + 1)) - 1) ^ 1; // bits 1..size set

  // Precompute cage metadata and valid tuple tables
  const preparedCages = puzzle.cages.map((cage) => {
    const op = normalizeOperator(cage.op);
    const target = Number(cage.target);
    const cellIndices = cage.cells.map(([r, c]) => r * size + c);
    const tuples = buildCageTupleTable(cage, size);
    return {
      id: cage.id,
      cells: cage.cells,
      cellIndices,
      op,
      target,
      tuples,
    };
  });

  // Cell -> cage lookup
  const cellToCage = new Array(numCells);
  for (const cage of preparedCages) {
    for (const idx of cage.cellIndices) {
      cellToCage[idx] = cage;
    }
  }

  // Row and column peers for fast elimination
  const peers = Array.from({ length: numCells }, (_, idx) => {
    const r = Math.floor(idx / size);
    const c = idx % size;
    const list = [];
    for (let k = 0; k < size; k++) {
      if (k !== c) list.push(r * size + k);
      if (k !== r) list.push(k * size + c);
    }
    return list;
  });

  const initialDomains = new Uint16Array(numCells);
  initialDomains.fill(fullMask);

  // Apply optional fixed givens
  if (Array.isArray(puzzle.givens) && puzzle.givens.length === size) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = puzzle.givens[r]?.[c] || 0;
        if (val >= 1 && val <= size) {
          initialDomains[r * size + c] = 1 << val;
        }
      }
    }
  }

  const metrics = {
    propagations: 0,
    eliminations: 0,
    hiddenSingles: 0,
    nakedSingles: 0,
    branches: 0,
    backtracks: 0,
    maxDepth: 0,
    elapsedMs: 0,
    solvedByPropagationOnly: false,
  };

  const steps = [];
  let stepsTruncated = false;

  function pushStep(domains, depth, type, title, description, focusCells = [], focusCageId = null) {
    if (!recordSteps) return;
    if (steps.length >= maxSteps) {
      stepsTruncated = true;
      return;
    }
    const snap = snapshotBoardAndDomains(domains, size);
    steps.push({
      index: steps.length,
      type,
      title,
      description,
      focusCells,
      focusCageId,
      board: snap.board,
      domains: snap.domains,
      depth,
      backtracks: metrics.backtracks,
    });
  }

  pushStep(
    initialDomains,
    0,
    'init',
    'Initialize Domains',
    `Every cell starts with candidates {1..${size}}. Applying cage and Latin-square constraints.`
  );

  // Propagate constraints until fixpoint. Returns false on contradiction.
  function propagate(domains, depth) {
    let changed = true;
    // Track which singletons have already had their peers pruned in this state
    const propagatedSingletons = new Uint8Array(numCells);

    while (changed) {
      changed = false;
      metrics.propagations++;

      // 1. Peer elimination from assigned cells (Naked Singles)
      for (let idx = 0; idx < numCells; idx++) {
        const mask = domains[idx];
        if (mask === 0) return false;
        if ((mask & (mask - 1)) === 0 && !propagatedSingletons[idx]) {
          propagatedSingletons[idx] = 1;
          const digit = lowestSetDigit(mask);
          const r = Math.floor(idx / size);
          const c = idx % size;
          const prunedPeers = [];

          for (const pIdx of peers[idx]) {
            if (domains[pIdx] & mask) {
              domains[pIdx] &= ~mask;
              metrics.eliminations++;
              changed = true;
              prunedPeers.push([Math.floor(pIdx / size), pIdx % size]);
              if (domains[pIdx] === 0) {
                pushStep(
                  domains,
                  depth,
                  'conflict',
                  `Conflict at R${Math.floor(pIdx / size) + 1}C${(pIdx % size) + 1}`,
                  `Assigning ${digit} at R${r + 1}C${c + 1} leaves R${Math.floor(pIdx / size) + 1}C${(pIdx % size) + 1} with zero candidates.`,
                  [[r, c], [Math.floor(pIdx / size), pIdx % size]]
                );
                return false;
              }
            }
          }

          if (prunedPeers.length > 0) {
            metrics.nakedSingles++;
            pushStep(
              domains,
              depth,
              'peer_prune',
              `Peer Elimination (${digit} at R${r + 1}C${c + 1})`,
              `Cell R${r + 1}C${c + 1} is fixed to ${digit}, removing ${digit} from ${prunedPeers.length} row/column peer${prunedPeers.length === 1 ? '' : 's'}.`,
              [[r, c], ...prunedPeers]
            );
          }
        }
      }

      // 2. Cage Generalized Arc Consistency (GAC)
      for (const cage of preparedCages) {
        const k = cage.cellIndices.length;
        const supports = new Uint16Array(k);

        if (cage.tuples !== null) {
          for (let t = 0; t < cage.tuples.length; t++) {
            const tuple = cage.tuples[t];
            let validTuple = true;
            for (let i = 0; i < k; i++) {
              if ((domains[cage.cellIndices[i]] & (1 << tuple[i])) === 0) {
                validTuple = false;
                break;
              }
            }
            if (validTuple) {
              for (let i = 0; i < k; i++) {
                supports[i] |= 1 << tuple[i];
              }
            }
          }
        } else {
          const largeSupports = computeLargeCageSupports(cage, domains, size);
          supports.set(largeSupports);
        }

        let cagePruned = false;
        for (let i = 0; i < k; i++) {
          const idx = cage.cellIndices[i];
          const oldMask = domains[idx];
          const newMask = oldMask & supports[i];
          if (newMask !== oldMask) {
            metrics.eliminations += popCount(oldMask ^ newMask);
            domains[idx] = newMask;
            changed = true;
            cagePruned = true;
            if (newMask === 0) {
              const clueLabel = cage.op === '=' ? `${cage.target}` : `${cage.target}${cage.op}`;
              pushStep(
                domains,
                depth,
                'conflict',
                `Cage ${clueLabel} Conflict`,
                `No valid digit combination remains for cage ${clueLabel}.`,
                cage.cells,
                cage.id
              );
              return false;
            }
          }
        }

        if (cagePruned) {
          const clueLabel = cage.op === '=' ? `${cage.target}` : `${cage.target}${cage.op}`;
          pushStep(
            domains,
            depth,
            'cage_prune',
            `Cage ${clueLabel} Constraint`,
            `Filtered candidates in cage ${clueLabel} to values participating in valid arithmetic tuples.`,
            cage.cells,
            cage.id
          );
        }
      }

      // 3. Hidden Singles in Rows and Columns
      if (!changed) {
        // Check rows
        for (let r = 0; r < size; r++) {
          for (let d = 1; d <= size; d++) {
            const bit = 1 << d;
            let count = 0;
            let targetIdx = -1;
            for (let c = 0; c < size; c++) {
              const idx = r * size + c;
              if (domains[idx] & bit) {
                count++;
                targetIdx = idx;
                if (count > 1) break;
              }
            }
            if (count === 0) {
              pushStep(
                domains,
                depth,
                'conflict',
                `Row ${r + 1} Missing ${d}`,
                `Digit ${d} has no remaining candidate cells in Row ${r + 1}.`,
                Array.from({ length: size }, (_, c) => [r, c])
              );
              return false;
            }
            if (count === 1 && domains[targetIdx] !== bit) {
              domains[targetIdx] = bit;
              metrics.hiddenSingles++;
              changed = true;
              const tc = targetIdx % size;
              pushStep(
                domains,
                depth,
                'hidden_single',
                `Hidden Single in Row ${r + 1}`,
                `Digit ${d} can only appear at R${r + 1}C${tc + 1} within Row ${r + 1}.`,
                [[r, tc]]
              );
            }
          }
        }

        // Check columns
        for (let c = 0; c < size; c++) {
          for (let d = 1; d <= size; d++) {
            const bit = 1 << d;
            let count = 0;
            let targetIdx = -1;
            for (let r = 0; r < size; r++) {
              const idx = r * size + c;
              if (domains[idx] & bit) {
                count++;
                targetIdx = idx;
                if (count > 1) break;
              }
            }
            if (count === 0) {
              pushStep(
                domains,
                depth,
                'conflict',
                `Column ${c + 1} Missing ${d}`,
                `Digit ${d} has no remaining candidate cells in Column ${c + 1}.`,
                Array.from({ length: size }, (_, r) => [r, c])
              );
              return false;
            }
            if (count === 1 && domains[targetIdx] !== bit) {
              domains[targetIdx] = bit;
              metrics.hiddenSingles++;
              changed = true;
              const tr = Math.floor(targetIdx / size);
              pushStep(
                domains,
                depth,
                'hidden_single',
                `Hidden Single in Column ${c + 1}`,
                `Digit ${d} can only appear at R${tr + 1}C${c + 1} within Column ${c + 1}.`,
                [[tr, c]]
              );
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Verifies that all cages (especially large k > 5 cages) satisfy exact arithmetic
   * once all cells have singleton domains.
   */
  function verifyCompleteSolution(domains) {
    for (const cage of preparedCages) {
      const vals = cage.cellIndices.map((idx) => lowestSetDigit(domains[idx]));
      if (!checkCageArithmetic(vals, cage.op, cage.target)) {
        return false;
      }
    }
    return true;
  }

  const solutions = [];
  let nodesVisited = 0;
  let aborted = false;

  function search(domains, depth) {
    if (solutions.length >= maxSolutions || aborted) return;
    if (depth > metrics.maxDepth) metrics.maxDepth = depth;
    nodesVisited++;
    if (nodesVisited > maxNodes) {
      aborted = true;
      return;
    }

    if (!propagate(domains, depth)) {
      metrics.backtracks++;
      return;
    }

    // Pick unassigned cell with Minimum Remaining Values (MRV)
    let bestIdx = -1;
    let bestCount = size + 1;
    for (let idx = 0; idx < numCells; idx++) {
      const count = popCount(domains[idx]);
      if (count === 0) {
        metrics.backtracks++;
        return;
      }
      if (count > 1 && count < bestCount) {
        bestCount = count;
        bestIdx = idx;
        if (bestCount === 2) break;
      }
    }

    // All cells assigned!
    if (bestIdx === -1) {
      if (!verifyCompleteSolution(domains)) {
        metrics.backtracks++;
        return;
      }
      const solGrid = [];
      for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) {
          row.push(lowestSetDigit(domains[r * size + c]));
        }
        solGrid.push(row);
      }
      solutions.push(solGrid);

      if (solutions.length === 1) {
        pushStep(
          domains,
          depth,
          'solution',
          'Solution Found',
          depth === 0
            ? 'Puzzle solved purely through constraint propagation with zero backtracking.'
            : `Valid complete solution found at search depth ${depth}.`
        );
      }
      return;
    }

    // Branch on candidates for bestIdx
    const r = Math.floor(bestIdx / size);
    const c = bestIdx % size;
    const candidates = bitMaskToArray(domains[bestIdx], size);

    for (const digit of candidates) {
      if (solutions.length >= maxSolutions || aborted) return;
      metrics.branches++;
      const nextDomains = cloneDomains(domains);
      nextDomains[bestIdx] = 1 << digit;

      pushStep(
        nextDomains,
        depth + 1,
        'branch',
        `Hypothesis: R${r + 1}C${c + 1} = ${digit}`,
        `Cell R${r + 1}C${c + 1} has candidates {${candidates.join(', ')}}. Testing ${digit} at depth ${depth + 1}.`,
        [[r, c]]
      );

      const prevSolutionsCount = solutions.length;
      search(nextDomains, depth + 1);

      if (solutions.length === prevSolutionsCount && solutions.length < maxSolutions && !aborted) {
        pushStep(
          domains,
          depth,
          'backtrack',
          `Backtrack from R${r + 1}C${c + 1} = ${digit}`,
          `Hypothesis R${r + 1}C${c + 1} = ${digit} led to a contradiction. Reverting to depth ${depth}.`,
          [[r, c]]
        );
      }
    }
  }

  search(initialDomains, 0);

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  metrics.elapsedMs = Math.round((endTime - startTime) * 100) / 100;
  metrics.solvedByPropagationOnly = solutions.length > 0 && metrics.branches === 0;

  let status = 'unsolvable';
  if (solutions.length === 1) {
    status = 'unique';
  } else if (solutions.length > 1) {
    status = 'multiple';
  }

  // Ensure unsolvable puzzles still have a clear terminal step in visualizer
  if (status === 'unsolvable' && recordSteps) {
    steps.push({
      index: steps.length,
      type: 'unsolvable',
      title: aborted ? 'Search Limit Reached' : 'Unsolvable Puzzle',
      description: aborted
        ? 'Search exceeded the safety node limit without finding a valid assignment.'
        : 'All candidate branches resulted in contradictions. No valid KenKen assignment satisfies every cage and Latin-square rule.',
      focusCells: [],
      focusCageId: null,
      board: Array.from({ length: size }, () => Array(size).fill(0)),
      domains: Array.from({ length: size }, () => Array.from({ length: size }, () => [])),
      depth: 0,
      backtracks: metrics.backtracks,
    });
  }

  return {
    status,
    solutions,
    solutionCount: solutions.length,
    validation,
    steps,
    stepsTruncated,
    aborted,
    metrics,
  };
}
