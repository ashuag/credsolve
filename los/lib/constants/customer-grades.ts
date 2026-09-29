/**
 * CIBIL credit-assessment grade letters, best (A) to worst (H) — mirrors the backend's
 * `CibilCategory` / `CIBIL_CATEGORIES` (`backend/src/common/cibil/cibil-credit-assessment.engine.ts`).
 * Single source of truth for every grade dropdown/filter/checkbox list in the LOS app instead of
 * each page re-declaring the letters.
 */
export const CUSTOMER_GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type CustomerGrade = (typeof CUSTOMER_GRADES)[number];

/** `{ value, label }` options for a grade `select`/`multi-select` table filter. */
export const CUSTOMER_GRADE_FILTER_OPTIONS = CUSTOMER_GRADES.map((grade) => ({ value: grade, label: grade }));
