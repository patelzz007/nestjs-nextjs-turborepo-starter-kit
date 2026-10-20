/**
 * Counts the rows that would violate a composite tenant foreign key (multi-tenancy plan MT-60, §7):
 * a child row whose parent belongs to another tenant.
 *
 *   pnpm db:check-tenant-integrity
 *
 * Read-only, under the `tenancy.data_check` system operation. It prints one line per relation and
 * exits 1 when any count is non-zero. It never fixes data: a violation is reported for a human.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { TENANT_INTEGRITY_CHECK_OPERATION, TENANT_INTEGRITY_RELATIONS, type TenantIntegrityRelation } from "../../src/platform/infrastructure/tenancy/tenant-integrity";

const EXIT_OK = 0;
const EXIT_VIOLATIONS = 1;

/** Table and column names are interpolated as quoted identifiers: only these shapes are accepted. */
const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*$/;

/** Thrown when a relation names an identifier that is not safe to quote into SQL. */
export class UnsafeIntegrityIdentifierError extends Error {
	public constructor(identifier: string) {
		super(`Unsafe identifier in a tenant integrity relation: ${identifier}`);
		this.name = "UnsafeIntegrityIdentifierError";
	}
}

function quoted(identifier: string): string {
	if (!SAFE_IDENTIFIER.test(identifier)) {
		throw new UnsafeIntegrityIdentifierError(identifier);
	}
	return `"${identifier}"`;
}

/** The query counting `relation`'s child rows whose parent has a different `tenantId`. */
export function violationCountSql(relation: TenantIntegrityRelation): string {
	const child = quoted(relation.child);
	const parent = quoted(relation.parent);
	const foreignKey = quoted(relation.foreignKey);
	return `SELECT count(*)::int AS violations FROM public.${child} c JOIN public.${parent} p ON p.id = c.${foreignKey} WHERE c.${foreignKey} IS NOT NULL AND p."tenantId" <> c."tenantId"`;
}

/** One relation's outcome. */
export interface IntegrityCount {
	readonly relation: TenantIntegrityRelation;
	readonly violations: number;
}

/** Where the counts come from. */
export interface IntegrityCountStore {
	count(relation: TenantIntegrityRelation): Promise<number>;
}

/** Counts every §7 relation. */
export async function checkTenantIntegrity(
	store: IntegrityCountStore,
	relations: readonly TenantIntegrityRelation[] = TENANT_INTEGRITY_RELATIONS,
): Promise<readonly IntegrityCount[]> {
	const counts: IntegrityCount[] = [];
	for (const relation of relations) {
		counts.push({ relation, violations: await store.count(relation) });
	}
	return counts;
}

/** The printed table: one line per relation, then the verdict. */
export function formatIntegrityReport(counts: readonly IntegrityCount[]): string {
	const lines = counts.map(
		({ relation, violations }: IntegrityCount): string =>
			`${violations === 0 ? "ok  " : "FAIL"}  ${relation.child}(tenantId, ${relation.foreignKey}) -> ${relation.parent}(tenantId, id): ${String(violations)}`,
	);
	const total = counts.reduce((sum: number, count: IntegrityCount): number => sum + count.violations, 0);
	const verdict =
		total === 0 ? "No cross-tenant rows: every composite tenant foreign key holds." : `${String(total)} cross-tenant row(s). Do not add the foreign keys; report to a human.`;
	return [...lines, verdict].join("\n");
}

/** Exit code for `counts`: 1 when any relation has a violation. */
export function integrityExitCode(counts: readonly IntegrityCount[]): number {
	return counts.some((count: IntegrityCount): boolean => count.violations > 0) ? EXIT_VIOLATIONS : EXIT_OK;
}

const ViolationRowSchema = z.object({ violations: z.number().int().nonnegative() });

/** Counts with read-only transactions as `app_runtime` under `tenancy.data_check`. */
export function createPrismaIntegrityStore(prisma: PrismaClient): IntegrityCountStore {
	return {
		count: (relation: TenantIntegrityRelation): Promise<number> =>
			prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<number> => {
				await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
				await tx.$executeRaw`SELECT
					set_config('role', 'app_runtime', true),
					set_config('app.rls_bypass', 'true', true),
					set_config('app.system_operation', ${TENANT_INTEGRITY_CHECK_OPERATION}, true)`;
				const [row] = z.array(ViolationRowSchema).parse(await tx.$queryRawUnsafe(violationCountSql(relation)));
				return row?.violations ?? 0;
			}),
	};
}

async function main(): Promise<number> {
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
	try {
		const counts = await checkTenantIntegrity(createPrismaIntegrityStore(prisma));
		process.stdout.write(`${formatIntegrityReport(counts)}\n`);
		return integrityExitCode(counts);
	} finally {
		await prisma.$disconnect();
	}
}

if (process.env.VITEST !== "true") {
	void main().then((code: number): void => {
		process.exitCode = code;
	});
}
