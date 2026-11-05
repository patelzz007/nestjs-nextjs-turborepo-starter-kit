// ============================================
// platform/domain/record-retention.ts — how long the platform keeps its records
// ============================================
// One retention for everything the platform records (decided 2026-11-03): the request audit and row-change
// logs, the permission audit, notifications and their deliveries, and the transaction log files are kept
// for TEN years, then retired (soft-deleted, never hard-deleted, where a job retires them at all). Every
// retention job reads this constant, so changing the policy is one edit.
//
// Not covered, on purpose: backups (a storage budget, set in the Operations console) and consumed one-time
// tokens (security material, not records: kept a few days for support, then removed).

/** Years every record is kept. */
export const RECORD_RETENTION_YEARS = 10;

const DAYS_PER_YEAR = 365;
/** Leap days in any ten-year span (at least two, at most three): the longer, so nothing goes early. */
const LEAP_DAYS_IN_TEN_YEARS = 3;
const MS_PER_DAY = 86_400_000;

/** {@link RECORD_RETENTION_YEARS} in days, counting the leap days. */
export const RECORD_RETENTION_DAYS: number = RECORD_RETENTION_YEARS * DAYS_PER_YEAR + LEAP_DAYS_IN_TEN_YEARS;

/** {@link RECORD_RETENTION_YEARS} in milliseconds. */
export const RECORD_RETENTION_MS: number = RECORD_RETENTION_DAYS * MS_PER_DAY;
