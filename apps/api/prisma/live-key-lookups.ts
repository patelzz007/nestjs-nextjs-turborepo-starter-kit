// ============================================
// prisma/live-key-lookups.ts — lookups by a live-only key must say "live rows only" (Q9, 2026-11-03)
// ============================================
// `User.email` and `Location (tenantId, code)` are unique among live rows only (partial uniques). Prisma still
// accepts them as `findUnique` keys, and the compiler can't tell the difference: `findUnique({ where: { email } })`
// may return a soft-deleted account that shares the email, and `upsert` keyed by them fails at runtime
// (PostgreSQL can't `ON CONFLICT` on a partial index). So every query on those models whose `where` filters by
// the key must also filter `isDeleted`. The unit spec runs this scan over the API, the seeds and the scripts.

/** A model with a live-only key, and the field of that key a lookup names. */
interface LiveOnlyKey {
	/** The Prisma client delegate, as code calls it (`prisma.user`, `tx.location`). */
	readonly delegate: string;
	readonly field: string;
}

export const LIVE_ONLY_KEYS: readonly LiveOnlyKey[] = [
	{ delegate: "user", field: "email" },
	{ delegate: "location", field: "code" },
];

/** A query on a live-only key whose `where` doesn't filter `isDeleted`. */
export interface UnfilteredLiveKeyLookup {
	readonly line: number;
	readonly delegate: string;
	readonly field: string;
}

/** `where: { … }`, one level of nested braces deep (enough for `email: { in: [...] }`). */
const WHERE_OBJECT = /where:\s*(?<body>\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/u;

/** How far past the call a `where` may start (the call's options object). */
const CALL_WINDOW = 400;

/** Every query in `source` on a live-only key that doesn't also filter `isDeleted`. */
export function unfilteredLiveKeyLookups(source: string): readonly UnfilteredLiveKeyLookup[] {
	const found: UnfilteredLiveKeyLookup[] = [];
	for (const { delegate, field } of LIVE_ONLY_KEYS) {
		const call = new RegExp(
			String.raw`\.${delegate}\.(?:findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|count|update|updateMany|upsert|delete|deleteMany)\(`,
			"gu",
		);
		const key = new RegExp(String.raw`[{,]\s*${field}\s*[:,}]`, "u");
		for (const match of source.matchAll(call)) {
			const window = source.slice(match.index, match.index + CALL_WINDOW);
			const body = WHERE_OBJECT.exec(window)?.groups?.body;
			if (body !== undefined && key.test(body) && !body.includes("isDeleted")) {
				found.push({ line: source.slice(0, match.index).split("\n").length, delegate, field });
			}
		}
	}
	return found;
}
