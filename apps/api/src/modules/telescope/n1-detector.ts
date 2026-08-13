import type { QueryLogEntry, TelescopeN1Warning } from "@workspace/shared";

/** A request running the same model+operation this many times is an N+1 smell. */
export const N1_THRESHOLD = 5;

const MODEL_FROM_SQL_PATTERN = /(?:from|into|update|join|delete\s+from)\s+["`]?([A-Za-z_][A-Za-z0-9_]*)/i;

/**
 * Best-effort table/model name from raw SQL: `SELECT ... FROM "User"` → `User`.
 * Prisma's `query` event does not report the model under driver adapters
 * (Prisma 7), so the first referenced table is the group key for N+1
 * detection. Falls back to `""` (ungroupable) when the SQL is ambiguous.
 */
export function modelFromSql(sql: string): string {
	const match: RegExpMatchArray | null = MODEL_FROM_SQL_PATTERN.exec(sql);
	return match !== null ? match[1] : "";
}

/**
 * Improvement 7 — N+1 detector (pure function, unit-tested).
 *
 * Groups a request's queries by `operation:model` and flags groups that ran
 * at least `N1_THRESHOLD` times, sorted by total wall time (the most
 * expensive smell first). `totalMs` makes the damage visible: 30 × 4ms is
 * still an N+1 even when each query is fast.
 */
export function detectN1Warnings(queries: readonly QueryLogEntry[]): readonly TelescopeN1Warning[] {
	const groups = new Map<string, TelescopeN1Warning>();

	for (const query of queries) {
		const key = `${query.operation}:${query.model}`;
		const existing: TelescopeN1Warning | undefined = groups.get(key);
		if (existing !== undefined) {
			groups.set(key, { ...existing, count: existing.count + 1, totalMs: existing.totalMs + query.durationMs });
		} else {
			groups.set(key, { model: query.model, operation: query.operation, count: 1, totalMs: query.durationMs });
		}
	}

	return [...groups.values()]
		.filter((warning: TelescopeN1Warning): boolean => warning.count >= N1_THRESHOLD)
		.sort((a: TelescopeN1Warning, b: TelescopeN1Warning): number => b.totalMs - a.totalMs);
}
