import { SessionData } from './types';

export function createEmptySession(): SessionData {
  return {
    startedUnix: Math.floor(Date.now() / 1000),
    totalSecs: 0,
    perFrame: {},
    visits: {},
    questions: [],
    inkStrokes: 0,
  };
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export interface PaceInfo {
  diffSec: number; // positive = ahead, negative = behind
  label: string;
  status: 'ahead' | 'ontrack' | 'behind';
  suggestedSkipSlides: number;
}

export function computePace(
  elapsedSec: number,
  targetMinutes: number,
  currentPage: number,
  numPages: number
): PaceInfo | null {
  if (numPages <= 1 || targetMinutes <= 0 || elapsedSec < 5) return null;
  const targetSec = targetMinutes * 60;
  const expectedElapsed = ((currentPage - 1) / Math.max(1, numPages - 1)) * targetSec;
  const diffSec = Math.round(expectedElapsed - elapsedSec);

  const absMin = Math.round(Math.abs(diffSec) / 60);
  const avgSecPerSlide = targetSec / numPages;
  const suggestedSkipSlides =
    diffSec < -avgSecPerSlide ? Math.max(1, Math.round(Math.abs(diffSec) / avgSecPerSlide)) : 0;

  if (Math.abs(diffSec) < 30) {
    return { diffSec, label: 'No ritmo', status: 'ontrack', suggestedSkipSlides: 0 };
  }
  if (diffSec > 0) {
    return {
      diffSec,
      label: `+${absMin > 0 ? `${absMin}m` : `${diffSec}s`} adiantado`,
      status: 'ahead',
      suggestedSkipSlides: 0,
    };
  }
  return {
    diffSec,
    label: `-${absMin > 0 ? `${absMin}m` : `${Math.abs(diffSec)}s`} atrasado`,
    status: 'behind',
    suggestedSkipSlides,
  };
}

export function computeInsights(
  session: SessionData,
  numPages: number,
  targetMinutes: number
): string[] {
  const out: string[] = [];
  if (numPages <= 0) return out;

  const times: Array<[number, number]> = [];
  for (let p = 1; p <= numPages; p++) {
    times.push([p, session.perFrame[p] || 0]);
  }
  const shown = times.filter(([, t]) => t >= 1).length;
  if (shown === 0) return ['Nenhum slide foi cronometrado ainda neste ensaio.'];

  if (targetMinutes > 0) {
    const d = session.totalSecs / 60 - targetMinutes;
    if (Math.abs(d) < 0.5) {
      out.push('Você concluiu exatamente dentro da sua meta de tempo.');
    } else {
      out.push(
        `Você ficou ${Math.abs(d).toFixed(1)} min ${d > 0 ? 'acima' : 'abaixo'} da meta de ${targetMinutes} min.`
      );
    }
  }

  const totalShownTime = times.reduce((acc, [, t]) => acc + t, 0);
  const mean = totalShownTime / shown;
  const slowest = times.reduce((best, cur) => (cur[1] > best[1] ? cur : best), [0, 0]);
  if (slowest[1] > mean * 1.5 && slowest[1] > 30) {
    out.push(
      `Slide ${slowest[0]} levou ${formatClock(slowest[1])} (${(slowest[1] / mean).toFixed(1)}× sua média).`
    );
  }

  const rushed = times.filter(([, t]) => t >= 0.5 && t < 4).map(([p]) => p);
  if (rushed.length > 0) {
    out.push(`Passagem muito rápida (< 4s) no(s) slide(s): ${rushed.join(', ')}.`);
  }

  const skipped = times.filter(([, t]) => t < 0.5).map(([p]) => p);
  if (skipped.length > 0) {
    out.push(`Slides não exibidos: ${skipped.join(', ')}.`);
  }

  const revisited = Object.entries(session.visits)
    .filter(([, v]) => v > 1)
    .map(([p]) => Number(p))
    .sort((a, b) => a - b);
  if (revisited.length > 0) {
    out.push(`Você retornou ao(s) slide(s): ${revisited.join(', ')}.`);
  }

  if (session.questions.length > 0) {
    const q = [...session.questions].sort((a, b) => a - b);
    out.push(`Dúvidas marcadas no(s) slide(s): ${q.join(', ')}. Vale revisar a explicação.`);
  }

  return out;
}
