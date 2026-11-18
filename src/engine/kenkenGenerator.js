import { cellKey } from './kenkenConstants.js';
import { solveKenKen } from './kenkenSolver.js';

/**
 * Procedural KenKen Puzzle Generator with verified unique solutions
 * and calibrated difficulty levels across 3×3 to 9×9 grids.
 */

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates a randomized valid N×N Latin square.
 * @param {number} size
 * @returns {number[][]}
 */
export function generateLatinSquare(size) {
  const base = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(((r + c) % size) + 1);
    }
    base.push(row);
  }

  // Shuffle rows, columns, and digit symbols
  const rowOrder = shuffleArray(Array.from({ length: size }, (_, i) => i));
  const colOrder = shuffleArray(Array.from({ length: size }, (_, i) => i));
  const symbolMap = shuffleArray(Array.from({ length: size }, (_, i) => i + 1));

  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      grid[r][c] = symbolMap[base[rowOrder[r]][colOrder[c]] - 1];
    }
  }

  // Additional randomized 2x2 Latin rectangle swaps to increase structural entropy
  for (let iter = 0; iter < size * size * 4; iter++) {
    const r1 = Math.floor(Math.random() * size);
    const r2 = Math.floor(Math.random() * size);
    if (r1 === r2) continue;
    const c1 = Math.floor(Math.random() * size);
    // Find a second column forming an alternating cycle or direct swap
    const v1 = grid[r1][c1];
    const v2 = grid[r2][c1];
    const c2 = grid[r1].indexOf(v2);
    if (c2 !== -1 && grid[r2][c2] === v1) {
      grid[r1][c1] = v2;
      grid[r2][c1] = v1;
      grid[r1][c2] = v1;
      grid[r2][c2] = v2;
    }
  }

  return grid;
}

function getDifficultyProfile(size, difficulty) {
  switch (difficulty) {
    case 'easy':
      return {
        maxCageSize: size <= 4 ? 2 : 3,
        singleCellChance: 0.24,
        twoCellChance: 0.55,
        threeCellChance: 0.21,
        fourCellChance: 0.0,
        preferDivSub: 0.45,
        minBranches: 0,
        maxBacktracks: 0,
      };
    case 'medium':
      return {
        maxCageSize: size <= 4 ? 3 : 3,
        singleCellChance: 0.1,
        twoCellChance: 0.48,
        threeCellChance: 0.36,
        fourCellChance: 0.06,
        preferDivSub: 0.62,
        minBranches: 0,
        maxBacktracks: 6,
      };
    case 'hard':
      return {
        maxCageSize: size <= 4 ? 3 : 4,
        singleCellChance: 0.04,
        twoCellChance: 0.35,
        threeCellChance: 0.41,
        fourCellChance: 0.2,
        preferDivSub: 0.72,
        minBranches: 1,
        maxBacktracks: 999,
      };
    case 'expert':
    default:
      return {
        maxCageSize: size <= 4 ? 4 : 4,
        singleCellChance: 0.0,
        twoCellChance: 0.28,
        threeCellChance: 0.42,
        fourCellChance: 0.3,
        preferDivSub: 0.78,
        minBranches: 2,
        maxBacktracks: 999,
      };
  }
}

function pickTargetCageSize(profile) {
  const roll = Math.random();
  if (roll < profile.singleCellChance) return 1;
  if (roll < profile.singleCellChance + profile.twoCellChance) return 2;
  if (roll < profile.singleCellChance + profile.twoCellChance + profile.threeCellChance) {
    return Math.min(3, profile.maxCageSize);
  }
  return Math.min(4, profile.maxCageSize);
}

/**
 * Carves contiguous cages over an N×N grid and computes arithmetic clues from the Latin square.
 */
function carveCages(latinSquare, difficulty) {
  const size = latinSquare.length;
  const profile = getDifficultyProfile(size, difficulty);
  const assigned = Array.from({ length: size }, () => Array(size).fill(-1));
  const rawCages = [];

  const allCoords = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      allCoords.push([r, c]);
    }
  }
  const seeds = shuffleArray(allCoords);

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [sr, sc] of seeds) {
    if (assigned[sr][sc] !== -1) continue;

    const cageIndex = rawCages.length;
    const desiredSize = pickTargetCageSize(profile);
    const cells = [[sr, sc]];
    assigned[sr][sc] = cageIndex;

    while (cells.length < desiredSize) {
      const frontier = [];
      const seenFrontier = new Set();
      for (const [cr, cc] of cells) {
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && assigned[nr][nc] === -1) {
            const k = cellKey(nr, nc);
            if (!seenFrontier.has(k)) {
              seenFrontier.add(k);
              frontier.push([nr, nc]);
            }
          }
        }
      }
      if (frontier.length === 0) break;
      const pick = frontier[Math.floor(Math.random() * frontier.length)];
      assigned[pick[0]][pick[1]] = cageIndex;
      cells.push(pick);
    }

    rawCages.push(cells);
  }

  // For Medium/Hard/Expert, merge excessive 1-cell cages into neighboring small cages
  const maxSingles = difficulty === 'easy' ? Math.max(2, Math.floor(size * 0.6)) : difficulty === 'medium' ? 2 : 1;
  let singleIndices = rawCages
    .map((cells, idx) => (cells.length === 1 ? idx : -1))
    .filter((idx) => idx !== -1);

  for (const sIdx of singleIndices) {
    if (singleIndices.length <= maxSingles) break;
    const [sr, sc] = rawCages[sIdx][0];
    let bestNeighborCage = -1;
    let bestNeighborLen = 99;
    for (const [dr, dc] of dirs) {
      const nr = sr + dr;
      const nc = sc + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        const nIdx = assigned[nr][nc];
        if (nIdx !== sIdx && rawCages[nIdx].length < profile.maxCageSize && rawCages[nIdx].length < bestNeighborLen) {
          bestNeighborLen = rawCages[nIdx].length;
          bestNeighborCage = nIdx;
        }
      }
    }
    if (bestNeighborCage !== -1) {
      rawCages[bestNeighborCage].push([sr, sc]);
      assigned[sr][sc] = bestNeighborCage;
      rawCages[sIdx] = [];
      singleIndices = singleIndices.filter((x) => x !== sIdx);
    }
  }

  // Assign arithmetic operator & target from underlying Latin square values
  const cages = [];
  let cageCounter = 1;

  for (const cells of rawCages) {
    if (cells.length === 0) continue;
    const vals = cells.map(([r, c]) => latinSquare[r][c]);
    let op = '+';
    let target = 0;

    if (cells.length === 1) {
      op = '=';
      target = vals[0];
    } else if (cells.length === 2) {
      const a = vals[0];
      const b = vals[1];
      const maxV = Math.max(a, b);
      const minV = Math.min(a, b);
      const canDivide = maxV % minV === 0;
      const roll = Math.random();

      if (canDivide && roll < profile.preferDivSub * 0.55) {
        op = '÷';
        target = maxV / minV;
      } else if (roll < profile.preferDivSub) {
        op = '-';
        target = maxV - minV;
      } else if (Math.random() < 0.52) {
        op = '×';
        target = a * b;
      } else {
        op = '+';
        target = a + b;
      }
    } else {
      // 3 or 4 cells: choose × or + (bias × on harder levels if product stays reasonable)
      const prod = vals.reduce((acc, v) => acc * v, 1);
      const sum = vals.reduce((acc, v) => acc + v, 0);
      const useMult = difficulty === 'easy' ? Math.random() < 0.35 : Math.random() < 0.52;
      if (useMult && prod <= 5000) {
        op = '×';
        target = prod;
      } else {
        op = '+';
        target = sum;
      }
    }

    cages.push({
      id: `cage-${cageCounter++}`,
      cells,
      op,
      target,
    });
  }

  return cages;
}

function computeCageClueFromSolution(cells, latinSquare, preferDivSub = 0.65) {
  const vals = cells.map(([r, c]) => latinSquare[r][c]);
  if (cells.length === 1) {
    return { op: '=', target: vals[0] };
  }
  if (cells.length === 2) {
    const a = vals[0];
    const b = vals[1];
    const maxV = Math.max(a, b);
    const minV = Math.min(a, b);
    const canDivide = maxV % minV === 0;
    const roll = Math.random();
    if (canDivide && roll < preferDivSub * 0.55) {
      return { op: '÷', target: maxV / minV };
    }
    if (roll < preferDivSub) {
      return { op: '-', target: maxV - minV };
    }
    if (Math.random() < 0.52) {
      return { op: '×', target: a * b };
    }
    return { op: '+', target: a + b };
  }
  const prod = vals.reduce((acc, v) => acc * v, 1);
  const sum = vals.reduce((acc, v) => acc + v, 0);
  if (Math.random() < 0.5 && prod <= 5000) {
    return { op: '×', target: prod };
  }
  return { op: '+', target: sum };
}

/**
 * Splits one cage where two competing solutions differ, eliminating ambiguity
 * while preserving contiguous cage structure.
 */
function breakAmbiguityInCages(cages, latinSquare, solA, solB, preferDivSub) {
  // Find cages whose cells differ between solA and solB
  const candidates = [];
  for (let i = 0; i < cages.length; i++) {
    const cage = cages[i];
    if (cage.cells.length < 2) continue;
    const differs = cage.cells.some(([r, c]) => solA[r][c] !== solB[r][c]);
    if (differs) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  // Prefer splitting larger cages first so we keep 2-cell cages intact when possible
  candidates.sort((a, b) => cages[b].cells.length - cages[a].cells.length);
  const targetIdx = candidates[0];
  const targetCage = cages[targetIdx];

  const nextCages = cages.slice();
  const cells = targetCage.cells;

  if (cells.length === 2) {
    // Split 2-cell cage into two 1-cell "=" cages
    nextCages.splice(
      targetIdx,
      1,
      { id: `${targetCage.id}a`, cells: [cells[0]], op: '=', target: latinSquare[cells[0][0]][cells[0][1]] },
      { id: `${targetCage.id}b`, cells: [cells[1]], op: '=', target: latinSquare[cells[1][0]][cells[1][1]] }
    );
    return nextCages;
  }

  // For 3+ cell cage, peel off one differing cell (or leaf cell keeping remainder contiguous)
  for (let p = 0; p < cells.length; p++) {
    const peelCell = cells[p];
    const remaining = cells.filter((_, idx) => idx !== p);
    // Check orthogonal contiguity of remaining cells via quick BFS
    const remSet = new Set(remaining.map(([r, c]) => `${r},${c}`));
    const visited = new Set([`${remaining[0][0]},${remaining[0][1]}`]);
    const queue = [remaining[0]];
    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const k = `${cr + dr},${cc + dc}`;
        if (remSet.has(k) && !visited.has(k)) {
          visited.add(k);
          queue.push([cr + dr, cc + dc]);
        }
      }
    }
    if (visited.size === remaining.length) {
      const remClue = computeCageClueFromSolution(remaining, latinSquare, preferDivSub);
      nextCages.splice(
        targetIdx,
        1,
        { id: `${targetCage.id}a`, cells: remaining, ...remClue },
        { id: `${targetCage.id}b`, cells: [peelCell], op: '=', target: latinSquare[peelCell[0]][peelCell[1]] }
      );
      return nextCages;
    }
  }

  return null;
}

/**
 * Generates a verified unique-solution KenKen puzzle for the requested size and difficulty.
 *
 * @param {number} size - Grid dimension (3..9)
 * @param {'easy'|'medium'|'hard'|'expert'} [difficulty='medium']
 * @returns {{
 *   size: number,
 *   difficulty: string,
 *   cages: Array,
 *   solution: number[][],
 *   metrics: Object
 * }}
 */
export function generateKenKen(size, difficulty = 'medium') {
  const profile = getDifficultyProfile(size, difficulty);
  const maxAttempts = size >= 8 ? 14 : 32;
  let fallbackUnique = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const latinSquare = generateLatinSquare(size);
    let cages = carveCages(latinSquare, difficulty);
    let result = solveKenKen({ size, cages }, {
      maxSolutions: 2,
      recordSteps: false,
      maxNodes: 45000,
    });

    // If multiple solutions exist, break ambiguity by splitting up to 4 ambiguous cages
    let repairs = 0;
    while (result.status === 'multiple' && result.solutions.length >= 2 && repairs < 5) {
      const refined = breakAmbiguityInCages(
        cages,
        latinSquare,
        result.solutions[0],
        result.solutions[1],
        profile.preferDivSub
      );
      if (!refined) break;
      cages = refined;
      repairs++;
      result = solveKenKen({ size, cages }, {
        maxSolutions: 2,
        recordSteps: false,
        maxNodes: 45000,
      });
    }

    if (result.status !== 'unique') {
      continue;
    }

    const { branches, backtracks, solvedByPropagationOnly } = result.metrics;

    if (difficulty === 'easy' && solvedByPropagationOnly) {
      return { size, difficulty, cages, solution: result.solutions[0], metrics: result.metrics };
    }
    if (difficulty === 'medium' && backtracks <= profile.maxBacktracks) {
      return { size, difficulty, cages, solution: result.solutions[0], metrics: result.metrics };
    }
    if ((difficulty === 'hard' || difficulty === 'expert') && branches >= profile.minBranches) {
      return { size, difficulty, cages, solution: result.solutions[0], metrics: result.metrics };
    }

    const score =
      difficulty === 'easy'
        ? 100 - branches * 10
        : difficulty === 'medium'
          ? 100 - Math.abs(branches - 1) * 10
          : branches * 10 + backtracks;

    if (score > bestScore) {
      bestScore = score;
      fallbackUnique = {
        size,
        difficulty,
        cages,
        solution: result.solutions[0],
        metrics: result.metrics,
      };
    }
  }

  if (fallbackUnique) {
    return fallbackUnique;
  }

  // Deterministic guaranteed-unique fallback: pair rows with subtraction/addition and refine
  const latin = generateLatinSquare(size);
  let cages = [];
  let cid = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c += 2) {
      if (c + 1 < size) {
        const clue = computeCageClueFromSolution([[r, c], [r, c + 1]], latin, 0.7);
        cages.push({ id: `cage-${cid++}`, cells: [[r, c], [r, c + 1]], ...clue });
      } else {
        cages.push({ id: `cage-${cid++}`, cells: [[r, c]], op: '=', target: latin[r][c] });
      }
    }
  }

  let check = solveKenKen({ size, cages }, { maxSolutions: 2, recordSteps: false });
  let guard = 0;
  while (check.status === 'multiple' && guard < size * size) {
    const refined = breakAmbiguityInCages(cages, latin, check.solutions[0], check.solutions[1], 0.7);
    if (!refined) break;
    cages = refined;
    guard++;
    check = solveKenKen({ size, cages }, { maxSolutions: 2, recordSteps: false });
  }

  if (check.status === 'unique') {
    return { size, difficulty, cages, solution: check.solutions[0], metrics: check.metrics };
  }

  const safeCages = [];
  let scid = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      safeCages.push({ id: `cage-${scid++}`, cells: [[r, c]], op: '=', target: latin[r][c] });
    }
  }
  return {
    size,
    difficulty,
    cages: safeCages,
    solution: latin,
    metrics: { propagations: 1, branches: 0, backtracks: 0, solvedByPropagationOnly: true },
  };
}

/**
 * Curated preset puzzles for instant exploration (including unique, multi-solution, and unsolvable examples).
 */
export const CURATED_PRESETS = [
  {
    id: 'classic-4x4',
    name: 'Classic 4×4',
    tag: 'Unique · Easy',
    size: 4,
    // Underlying Latin square:
    // [2, 1, 4, 3]
    // [4, 3, 1, 2]
    // [1, 2, 3, 4]
    // [3, 4, 2, 1]
    cages: [
      { id: 'c1', cells: [[0, 0], [1, 0]], op: '÷', target: 2 },
      { id: 'c2', cells: [[0, 1], [0, 2]], op: '+', target: 5 },
      { id: 'c3', cells: [[0, 3], [1, 3]], op: '-', target: 1 },
      { id: 'c4', cells: [[1, 1], [1, 2], [2, 2]], op: '×', target: 9 },
      { id: 'c5', cells: [[2, 0], [3, 0]], op: '-', target: 2 },
      { id: 'c6', cells: [[2, 1], [3, 1]], op: '÷', target: 2 },
      { id: 'c7', cells: [[2, 3]], op: '=', target: 4 },
      { id: 'c8', cells: [[3, 2], [3, 3]], op: '+', target: 3 },
    ],
  },
  {
    id: 'classic-6x6',
    name: 'Strategic 6×6',
    tag: 'Unique · Hard',
    size: 6,
    cages: [
      { id: 'c1', cells: [[0, 0], [1, 0]], op: '+', target: 11 },
      { id: 'c2', cells: [[0, 1], [0, 2]], op: '÷', target: 2 },
      { id: 'c3', cells: [[0, 3], [1, 3]], op: '×', target: 20 },
      { id: 'c4', cells: [[0, 4], [0, 5], [1, 5], [2, 5]], op: '×', target: 6 },
      { id: 'c5', cells: [[1, 1], [1, 2]], op: '-', target: 3 },
      { id: 'c6', cells: [[1, 4], [2, 4]], op: '÷', target: 3 },
      { id: 'c7', cells: [[2, 0], [2, 1], [3, 0], [3, 1]], op: '×', target: 240 },
      { id: 'c8', cells: [[2, 2], [2, 3]], op: '×', target: 6 },
      { id: 'c9', cells: [[3, 2], [4, 2]], op: '×', target: 6 },
      { id: 'c10', cells: [[3, 3], [4, 3], [4, 4]], op: '+', target: 7 },
      { id: 'c11', cells: [[3, 4], [3, 5]], op: '×', target: 30 },
      { id: 'c12', cells: [[4, 0], [4, 1]], op: '×', target: 6 },
      { id: 'c13', cells: [[4, 5], [5, 5]], op: '+', target: 9 },
      { id: 'c14', cells: [[5, 0], [5, 1], [5, 2]], op: '+', target: 8 },
      { id: 'c15', cells: [[5, 3], [5, 4]], op: '÷', target: 2 },
    ],
  },
  {
    id: 'multi-solution-4x4',
    name: 'Ambiguous 4×4',
    tag: 'Multiple Solutions',
    size: 4,
    cages: [
      { id: 'm1', cells: [[0, 0], [0, 1]], op: '+', target: 5 },
      { id: 'm2', cells: [[0, 2], [0, 3]], op: '+', target: 5 },
      { id: 'm3', cells: [[1, 0], [1, 1]], op: '+', target: 5 },
      { id: 'm4', cells: [[1, 2], [1, 3]], op: '+', target: 5 },
      { id: 'm5', cells: [[2, 0], [2, 1]], op: '+', target: 5 },
      { id: 'm6', cells: [[2, 2], [2, 3]], op: '+', target: 5 },
      { id: 'm7', cells: [[3, 0], [3, 1]], op: '+', target: 5 },
      { id: 'm8', cells: [[3, 2], [3, 3]], op: '+', target: 5 },
    ],
  },
  {
    id: 'unsolvable-3x3',
    name: 'Contradictory 3×3',
    tag: 'Unsolvable',
    size: 3,
    cages: [
      { id: 'u1', cells: [[0, 0], [0, 1]], op: '+', target: 5 },
      { id: 'u2', cells: [[0, 2]], op: '=', target: 3 },
      { id: 'u3', cells: [[1, 0], [2, 0]], op: '+', target: 5 },
      { id: 'u4', cells: [[1, 1], [1, 2]], op: '-', target: 1 },
      { id: 'u5', cells: [[2, 1], [2, 2]], op: '+', target: 4 },
    ],
  },
];
