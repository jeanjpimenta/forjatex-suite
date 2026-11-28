export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type InkKind = 'pen' | 'highlighter';

export type ToolMode = 'none' | 'laser' | 'pen' | 'highlighter' | 'eraser';

export type FitMode = 'fit' | 'fill' | 'stretch';

export type DualMode = 'auto' | 'right' | 'off';

/** Normalized crop rectangle [x0, y0, x1, y1] in [0, 1] */
export type ZoomRect = [number, number, number, number];

export interface Stroke {
  kind: InkKind;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export interface SyncPayload {
  pdfPath: string | null;
  currentPage: number;
  dualMode: DualMode;
  fitMode: FitMode;
  frozen: boolean;
  zoomRect: ZoomRect | null;
  blackScreen: boolean;
  whiteScreen: boolean;
  laserPos: { x: number; y: number } | null;
  strokes: Stroke[];
}

export interface OutlineSection {
  title: string;
  page: number; // 1-based
  color: string;
}

export interface SearchMatch {
  page: number; // 1-based
  snippet: string;
}

export interface SessionData {
  startedUnix: number;
  totalSecs: number;
  perFrame: Record<number, number>; // 1-based page -> seconds
  visits: Record<number, number>;   // 1-based page -> visit count
  questions: number[];              // 1-based pages flagged with ?
  inkStrokes: number;
}

export interface DeckTab {
  id: string;
  pdfPath: string;
  pdfName: string;
  numPages: number;
  currentPage: number;
  dualMode: DualMode;
  detectedWide: boolean;
  strokesByPage: Record<number, Stroke[]>;
  bookmarks: number[];
  customNotes: Record<number, string>;
  elapsedSec: number;
  targetMinutes: number;
  session: SessionData;
  prevSession: SessionData | null;
  outline: OutlineSection[];
}
