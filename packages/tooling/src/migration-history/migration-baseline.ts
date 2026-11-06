/**
 * The migration baseline marker: `apps/api/prisma/migrations-baseline.json`.
 *
 * It names the OLDEST migration that is still history. Migrations older than
 * the baseline are no longer checked; the baseline and everything after it are
 * immutable. Moving the baseline forward is the only way to drop history, and
 * only acceptable when no shared or deployed database ran the dropped
 * migrations (procedure: docs/technical/operations/ci.md, "Migration baseline").
 */
import { z } from "zod";

/** Prisma migration directory name: 14-digit UTC timestamp + snake_case name. */
export const MIGRATION_DIRECTORY_PATTERN = /^\d{14}_[a-z0-9_]+$/;

export const MigrationBaselineSchema = z
	.object({
		baseline: z.string().regex(MIGRATION_DIRECTORY_PATTERN, "must be a migration directory name (<14-digit timestamp>_<snake_case_name>)"),
		reason: z.string().trim().min(1, "must say why history before the baseline was dropped"),
		since: z.iso.date({ error: "must be an ISO date (YYYY-MM-DD)" }),
	})
	.strict();

/**
 * Parses marker file text. `null` text means "no marker" (file absent).
 * @param source where the text came from, for error messages
 */

export function parseMigrationBaseline(text: string | null, source: string): z.output<typeof MigrationBaselineSchema> | null {
	if (text === null) {
		return null;
	}
	let result: ReturnType<typeof MigrationBaselineSchema.safeParse>;
	try {
		result = MigrationBaselineSchema.safeParse(JSON.parse(text));
	} catch {
		throw new Error(`${source} is not valid JSON`);
	}
	if (!result.success) {
		const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
		throw new Error(`${source} is invalid — ${issues}`);
	}
	return result.data;
}
