import { useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react';
import { MAX_GRID_SIZE, MIN_GRID_SIZE } from '../engine/kenkenConstants.js';

export default function ImageOcrPanel({
  onOcrImported,
  onEditBeforeSolve,
  onSolveNow,
  validation,
  lastOcrSummary,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imagePayload, setImagePayload] = useState(null);
  const [expectedSize, setExpectedSize] = useState('auto');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid PNG, JPG, or WEBP image file.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Image exceeds 12 MB limit. Please upload a smaller crop.');
      return;
    }
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreviewUrl(dataUrl);
      setImagePayload({
        imageBase64: dataUrl,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcr = async () => {
    if (!imagePayload) return;
    setIsScanning(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/ocr-kenken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePayload.imageBase64,
          mimeType: imagePayload.mimeType,
          expectedSize: expectedSize === 'auto' ? undefined : Number(expectedSize),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to recognize KenKen puzzle from image.');
      }

      if (!data?.puzzle) {
        throw new Error('Server returned an empty OCR payload.');
      }

      onOcrImported(data.puzzle);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to process image.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Image Upload &amp; Optical Recognition
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Upload a screenshot or photo of a KenKen puzzle. Thick cage boundaries, targets, and
          operators are extracted into an editable grid so you can verify or fix every cell before
          solving.
        </p>
      </section>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {previewUrl ? (
          <div className="space-y-3">
            <img
              src={previewUrl}
              alt="Uploaded KenKen puzzle preview"
              className="max-h-44 mx-auto rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white"
            />
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                {imagePayload?.fileName}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Replace image
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <Upload className="w-7 h-7 mx-auto text-slate-400" />
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Drop a KenKen image here
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              PNG, JPG, or WEBP up to 12 MB
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Choose Image File
            </button>
          </div>
        )}
      </div>

      {/* Size Hint + Scan Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
        <div>
          <label
            htmlFor="ocr-size-hint"
            className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
          >
            Grid Size Hint
          </label>
          <select
            id="ocr-size-hint"
            value={expectedSize}
            onChange={(e) => setExpectedSize(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="auto">Auto-detect</option>
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

        <button
          type="button"
          disabled={!imagePayload || isScanning}
          onClick={handleRunOcr}
          className="sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Recognizing Grid &amp; Cages...</span>
            </>
          ) : (
            <>
              <ScanLine className="w-4 h-4" />
              <span>Extract Puzzle via OCR</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* OCR Import Review & Mandatory Editable Step */}
      {lastOcrSummary && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {validation?.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span>
                Extracted {lastOcrSummary.size}×{lastOcrSummary.size} Grid ·{' '}
                {lastOcrSummary.cageCount} Cages
              </span>
            </div>
          </div>

          {lastOcrSummary.confidenceNote && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lastOcrSummary.confidenceNote}
            </p>
          )}

          {lastOcrSummary.warnings?.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {lastOcrSummary.warnings.map((w, idx) => (
                <li key={idx}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onEditBeforeSolve}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Cages &amp; Clues</span>
            </button>

            <button
              type="button"
              disabled={!validation?.valid}
              onClick={onSolveNow}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Solve Extracted Grid</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
