export interface QuizResult {
  dim1: number;
  dim2: number;
  categoryScores: Record<string, number>; // e.g. { guns: -0.8, fiscal_tax: 0.5, ... }
}

const STORAGE_KEY = "civicism_quiz_result";

export function saveQuizResult(result: QuizResult) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch {
    // sessionStorage unavailable (private browsing restrictions etc.)
  }
}

export function getQuizResult(): QuizResult | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Invalidate old results that don't have categoryScores
    if (!parsed || typeof parsed.categoryScores !== "object") return null;
    return parsed as QuizResult;
  } catch {
    return null;
  }
}

export function clearQuizResult() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
