// ============================================
// label-pack.ts - one surface's copy in every shipped language (ADR 076)
// ============================================
// A surface declares its copy as an interface (`AppLockLabels`, `NavigationLabels`, …) and gives one
// value per language. Interpolation is a typed function (`(name) => string`), so a translation can
// reorder words without format strings. Screens read their pack with `useLabels(pack)`.

import type { AppLanguage } from "@workspace/shared";

/** A surface's copy, complete in every shipped language: a missing language is a type error. */
export type LabelPack<TLabels> = Readonly<Record<AppLanguage, TLabels>>;
