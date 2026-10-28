import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { DEFAULT_DATABASE_ROLE, type DatabaseRole } from "../../../prisma/system-operation.registry";
import { PrismaService } from "../../../prisma/prisma.service";
import type { ModuleHealthIndicator, ModuleHealthReport } from "../../presentation/http/health/health.service";

// ============================================
// Runtime-role proof (multi-tenancy plan D9, MT-53)
// ============================================
// Tenant isolation rests on two database facts the application cannot see from its own code:
//   1. the role every request runs as (`app_runtime`) can never bypass row-level security, and
//   2. every table forces RLS, so even its owner (the migration login) is filtered by the policies.
// This proof reads both from the catalog at boot — the API refuses to start when either is false —
// and again on every readiness probe, so a later `ALTER ROLE … BYPASSRLS` or `NO FORCE` takes the
// instance out of rotation. The same check runs in CI (DB-006, test/rls/runtime-role.e2e-spec.ts).

/** One `pg_roles` row of a role the API switches to. */
export interface RuntimeRoleFacts {
	readonly role: DatabaseRole;
	readonly exists: boolean;
	readonly isSuperuser: boolean;
	readonly bypassesRls: boolean;
}

/** One `pg_class` row of an application table. */
export interface TableRlsFacts {
	readonly table: string;
	readonly exists: boolean;
	readonly rlsEnabled: boolean;
	readonly rlsForced: boolean;
}

/** Everything the proof needs, read from the catalog. */
export interface RuntimeRoleProofFacts {
	readonly role: RuntimeRoleFacts;
	readonly tables: readonly TableRlsFacts[];
}

/** One broken guarantee, named so the operator can fix it. */
export interface RuntimeRoleProofFailure {
	readonly subject: string;
	readonly problem: string;
}

/** Every table the API owns: the Prisma models, whose names are the table names (no `@map`). */
export const APPLICATION_TABLES: readonly string[] = Object.values(Prisma.ModelName);

/** The broken guarantees in `facts`; empty when tenant isolation holds. */
export function evaluateRuntimeRoleProof(facts: RuntimeRoleProofFacts): readonly RuntimeRoleProofFailure[] {
	const failures: RuntimeRoleProofFailure[] = [];
	const { role } = facts;
	if (!role.exists) {
		failures.push({ subject: `role ${role.role}`, problem: "does not exist (run pnpm tools db:apply-security)" });
	}
	if (role.isSuperuser) {
		failures.push({ subject: `role ${role.role}`, problem: "is SUPERUSER, which ignores every RLS policy" });
	}
	if (role.bypassesRls) {
		failures.push({ subject: `role ${role.role}`, problem: "has BYPASSRLS, which ignores every RLS policy" });
	}
	for (const table of facts.tables) {
		if (!table.exists) {
			failures.push({ subject: `table ${table.table}`, problem: "does not exist (migrations not applied)" });
			continue;
		}
		if (!table.rlsEnabled) {
			failures.push({ subject: `table ${table.table}`, problem: "does not ENABLE ROW LEVEL SECURITY" });
		}
		if (!table.rlsForced) {
			failures.push({ subject: `table ${table.table}`, problem: "does not FORCE ROW LEVEL SECURITY, so its owner bypasses every policy" });
		}
	}
	return failures;
}

/** Thrown at boot when tenant isolation cannot be proven: the API must not serve a request. */
export class RuntimeRoleProofError extends Error {
	public constructor(failures: readonly RuntimeRoleProofFailure[]) {
		super(`Tenant isolation is not enforced by the database: ${failures.map((failure): string => `${failure.subject} ${failure.problem}`).join("; ")}`);
		this.name = "RuntimeRoleProofError";
	}
}

const RoleRowSchema = z.object({ rolsuper: z.boolean(), rolbypassrls: z.boolean() });
const TableRowSchema = z.object({ relname: z.string(), relrowsecurity: z.boolean(), relforcerowsecurity: z.boolean() });

/** Where the proof's facts come from. */
export interface RuntimeRoleFactsReader {
	read(role: DatabaseRole, tables: readonly string[]): Promise<RuntimeRoleProofFacts>;
}

/** Reads the proof's facts from `pg_roles` and `pg_class` (catalogs have no RLS of their own). */
@Injectable()
export class RuntimeRoleCatalog implements RuntimeRoleFactsReader {
	public constructor(private readonly prisma: PrismaService) {}

	public async read(role: DatabaseRole, tables: readonly string[]): Promise<RuntimeRoleProofFacts> {
		const roleRows = z.array(RoleRowSchema).parse(await this.prisma.$queryRaw`SELECT rolsuper, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = ${role}`);
		const tableRows = z
			.array(TableRowSchema)
			.parse(
				await this.prisma
					.$queryRaw`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p') AND c.relname = ANY(${[...tables]})`,
			);
		const [roleRow] = roleRows;
		const byName = new Map(tableRows.map((row): [string, z.output<typeof TableRowSchema>] => [row.relname, row]));
		return {
			role: { role, exists: roleRow !== undefined, isSuperuser: roleRow?.rolsuper ?? false, bypassesRls: roleRow?.rolbypassrls ?? false },
			tables: tables.map((table: string): TableRlsFacts => {
				const row = byName.get(table);
				return { table, exists: row !== undefined, rlsEnabled: row?.relrowsecurity ?? false, rlsForced: row?.relforcerowsecurity ?? false };
			}),
		};
	}
}

/** Boot gate and critical readiness indicator for {@link evaluateRuntimeRoleProof}. */
@Injectable()
export class RuntimeRoleProof implements OnModuleInit, ModuleHealthIndicator {
	private readonly logger: Logger = new Logger(RuntimeRoleProof.name);

	public constructor(@Inject(RuntimeRoleCatalog) private readonly catalog: RuntimeRoleFactsReader) {}

	public async onModuleInit(): Promise<void> {
		const failures = await this.failures();
		if (failures.length > 0) {
			throw new RuntimeRoleProofError(failures);
		}
		this.logger.log(`Tenant isolation proven: ${DEFAULT_DATABASE_ROLE} cannot bypass RLS and all ${String(APPLICATION_TABLES.length)} tables force it`);
	}

	public readonly isHealthy = async (): Promise<boolean> => (await this.failures()).length === 0;

	public readonly getReport = async (): Promise<ModuleHealthReport> => {
		const failures = await this.failures();
		return { role: DEFAULT_DATABASE_ROLE, tables: APPLICATION_TABLES.length, failures: failures.length };
	};

	private async failures(): Promise<readonly RuntimeRoleProofFailure[]> {
		return evaluateRuntimeRoleProof(await this.catalog.read(DEFAULT_DATABASE_ROLE, APPLICATION_TABLES));
	}
}
