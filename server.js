import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function normalizeOperator(rawOp, cellCount) {
  if (cellCount === 1) return "=";
  if (!rawOp) return "+";
  const s = String(rawOp).trim();
  if (s === "+" || s === "add") return "+";
  if (s === "-" || s === "−" || s === "–" || s === "sub") return "-";
  if (s === "×" || s === "*" || s === "x" || s === "X" || s === "mul")
    return "×";
  if (s === "÷" || s === "/" || s === "div") return "÷";
  if (s === "=") return cellCount === 1 ? "=" : "+";
  return "+";
}

/**
 * Normalizes raw Gemini Vision OCR output into a clean editable KenKen structure.
 */
function normalizeOcrResult(raw) {
  const size = Math.min(9, Math.max(3, Math.round(Number(raw?.size) || 4)));
  const seen = new Set();
  const cages = [];
  const warnings = Array.isArray(raw?.warnings) ? raw.warnings.map(String) : [];

  const rawCages = Array.isArray(raw?.cages) ? raw.cages : [];
  let cageIdx = 1;

  for (const rc of rawCages) {
    const rawCells = Array.isArray(rc?.cells) ? rc.cells : [];
    const cleanCells = [];

    for (const pair of rawCells) {
      let r;
      let c;
      if (Array.isArray(pair) && pair.length >= 2) {
        r = Math.round(Number(pair[0]));
        c = Math.round(Number(pair[1]));
      } else if (pair && typeof pair === "object") {
        r = Math.round(Number(pair.row));
        c = Math.round(Number(pair.col));
      } else {
        continue;
      }

      if (r >= 0 && r < size && c >= 0 && c < size) {
        const key = `${r},${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          cleanCells.push([r, c]);
        }
      }
    }

    if (cleanCells.length === 0) continue;

    const target = Math.max(1, Math.round(Number(rc?.target) || 1));
    const op = normalizeOperator(rc?.op, cleanCells.length);

    cages.push({
      id: `ocr-${cageIdx++}`,
      cells: cleanCells,
      op,
      target,
    });
  }

  // Track any cells not assigned by OCR so the user can see & assign them in the editor
  const missingCount = size * size - seen.size;
  if (missingCount > 0) {
    warnings.push(
      `${missingCount} cell${missingCount === 1 ? "" : "s"} had unclear boundaries and ${missingCount === 1 ? "was" : "were"} left unassigned for manual review.`,
    );
  }

  let givens = null;
  if (Array.isArray(raw?.givens) && raw.givens.length === size) {
    const parsedGivens = raw.givens.map((row) =>
      Array.isArray(row) && row.length === size
        ? row.map((v) => {
            const n = Math.round(Number(v) || 0);
            return n >= 1 && n <= size ? n : 0;
          })
        : Array(size).fill(0),
    );
    const hasAnyGiven = parsedGivens.some((row) => row.some((v) => v > 0));
    if (hasAnyGiven) {
      givens = parsedGivens;
    }
  }

  return {
    size,
    cages,
    givens,
    warnings,
    confidenceNote: raw?.confidenceNote ? String(raw.confidenceNote) : "",
  };
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/ocr-kenken", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured in the server environment.",
        });
      }

      const { imageBase64, mimeType, expectedSize } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "Missing base64 image payload." });
      }

      const cleanBase64 = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      const safeMime =
        typeof mimeType === "string" && mimeType.startsWith("image/")
          ? mimeType
          : "image/png";

      const sizeHint =
        expectedSize && Number(expectedSize) >= 3 && Number(expectedSize) <= 9
          ? `The user estimates the grid size is ${Number(expectedSize)}x${Number(expectedSize)}, though verify visually.`
          : "Determine the exact grid size N (between 3 and 9) by counting rows and columns.";

      const prompt = `You are a precision optical puzzle parser specialized in KenKen (Calcudoku) grids.
Analyze the provided KenKen puzzle image carefully.

${sizeHint}

Instructions:
1. Count the rows and columns to determine N (3 <= N <= 9). Use 0-based coordinates where row=0, col=0 is top-left and row=N-1, col=N-1 is bottom-right.
2. Identify every cage enclosed by thick/bold outer borders (ignoring thin inner cell gridlines).
3. Every cell in the N×N grid must belong to exactly one cage.
4. Read the small clue in the top-left corner of each cage:
   - "target": positive integer
   - "op": arithmetic operator "+", "-", "×", "÷", or "=" (use "=" when a single-cell cage has only a number and no operator).
   - Note: In printed KenKen puzzles, multiplication may appear as "×", "*", or "x"; division may appear as "÷" or "/"; subtraction as "-" or "−". Convert them to "+", "-", "×", "÷", or "=".
5. If there are large pre-filled solution digits inside cells (separate from the small corner cage clues), record them in "givens" (0 for empty cells). Otherwise leave "givens" empty.
6. If any boundary or digit is blurry or uncertain, add a concise note to "warnings" specifying the cell coordinates (1-based) so the user can edit it before solving.

Return valid JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              size: {
                type: Type.INTEGER,
                description: "Grid dimension N (between 3 and 9)",
              },
              cages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    target: { type: Type.INTEGER },
                    op: { type: Type.STRING },
                    cells: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          row: { type: Type.INTEGER },
                          col: { type: Type.INTEGER },
                        },
                        required: ["row", "col"],
                      },
                    },
                  },
                  required: ["target", "op", "cells"],
                },
              },
              givens: {
                type: Type.ARRAY,
                description:
                  "Optional N×N array of pre-filled large digits (0 for empty)",
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
              confidenceNote: { type: Type.STRING },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["size", "cages"],
          },
        },
      });

      const rawText = (response.text || "{}").trim();
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (_parseErr) {
        return res.status(502).json({
          error:
            "OCR model returned malformed JSON. Please retry with a clearer crop of the grid.",
        });
      }

      const normalized = normalizeOcrResult(parsed);
      return res.json({ puzzle: normalized });
    } catch (err) {
      const message =
        err?.message || "Unexpected error during KenKen OCR recognition.";
      const statusCode =
        err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return res.status(statusCode).json({ error: message });
    }
  });

  if (isProduction) {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`KenKen Studio server running at http://localhost:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
