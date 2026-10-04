import { z } from "zod";

/**
 * The ONLY places `pnpm db:check-seed-coverage` (scripts/check-seed-coverage.ts)
 * accepts an empty table or a nullable column that is NULL in every seeded row.
 *
 * The rule (docs/technical/database.md, "Seed coverage — every table, every column"): after `pnpm db:seed` every table holds rows and
 * every nullable column holds a real value in at least one row. An entry here is
 * a deliberate, reviewed exception — "we did not seed it" is never a reason;
 * seed it instead. Valid reasons are structural: the column can never hold a
 * value in a correct database (e.g. a legacy column the app only ever clears).
 *
 * The checker fails on a stale entry too (unknown table/column, or a gap that
 * the seed now fills), so this list can only shrink back to what is still true.
 */

/** A reason must be a real sentence a reviewer can judge, not a placeholder like "n/a". */
export const MIN_EXEMPTION_REASON_LENGTH = 40;

const ExemptionReasonSchema = z.string().trim().min(MIN_EXEMPTION_REASON_LENGTH);
/** A Postgres table/column name as the catalog reports it (vendored geo columns such as `wikiDataId` are camelCase). */
const IdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const SeedCoverageExemptionSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("empty-table"), table: IdentifierSchema, reason: ExemptionReasonSchema }),
	z.object({ kind: z.literal("null-column"), table: IdentifierSchema, column: IdentifierSchema, reason: ExemptionReasonSchema }),
]);

export type SeedCoverageExemption = z.infer<typeof SeedCoverageExemptionSchema>;

export const SEED_COVERAGE_EXEMPTIONS: readonly SeedCoverageExemption[] = [
	{
		kind: "null-column",
		table: "organization_kyb_files",
		column: "deleted_at",
		reason:
			"Submitted KYB evidence is retained for the review history: a resubmission retires a link (is_active = false) and DELETE /files/:id refuses submitted evidence (KYB_EVIDENCE_RETAINED), so no correct database holds a soft-deleted link.",
	},
	{
		kind: "null-column",
		table: "organization_kyb_files",
		column: "deleted_by",
		reason:
			"Submitted KYB evidence is retained for the review history: a resubmission retires a link (is_active = false) and DELETE /files/:id refuses submitted evidence (KYB_EVIDENCE_RETAINED), so no correct database holds a soft-deleted link.",
	},
];
