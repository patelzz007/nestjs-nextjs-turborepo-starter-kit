import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { ModuleHealthIndicator, ModuleHealthReport } from "../../health/health.service";
import { SYSTEM_ROLE_CATALOG } from "../reference-data/system-role-catalog";

/**
 * Readiness of the authorization system: every platform role the code depends on by
 * name (`SYSTEM_ROLE_CATALOG`) exists as a live system role. A missing role means the
 * reference data was never loaded (`pnpm --filter @workspace/api db:sync-reference-data`),
 * and every authorization decision that needs it would fail — so the indicator is
 * registered as CRITICAL (see module-health-indicators.provider.ts).
 *
 * Database errors are not caught here: the health service turns a thrown probe into
 * "down" and reports it.
 */
@Injectable()
export class AuthorizationHealthIndicator implements ModuleHealthIndicator {
	public constructor(private readonly prisma: PrismaService) {}

	public async isHealthy(): Promise<boolean> {
		return (await this.missingSystemRoles()).length === 0;
	}

	public async getReport(): Promise<ModuleHealthReport> {
		const missing: readonly string[] = await this.missingSystemRoles();
		return {
			systemRolesExpected: SYSTEM_ROLE_CATALOG.length,
			systemRolesMissing: missing.length === 0 ? null : missing.join(", "),
		};
	}

	/** Names from the catalog with no live system role, in catalog order. */
	private async missingSystemRoles(): Promise<readonly string[]> {
		const expected: readonly string[] = SYSTEM_ROLE_CATALOG.map((role) => role.name);
		const present = await this.prisma.role.findMany({
			where: { name: { in: [...expected] }, isSystem: true, isDeleted: false },
			select: { name: true },
		});
		const presentNames: ReadonlySet<string> = new Set(present.map((role) => role.name));
		return expected.filter((name) => !presentNames.has(name));
	}
}
