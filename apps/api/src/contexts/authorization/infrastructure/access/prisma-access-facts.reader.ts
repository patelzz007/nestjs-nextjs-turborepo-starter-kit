// ============================================
// infrastructure/access/prisma-access-facts.reader.ts — the caller's standing, from the database (ADR 067)
// ============================================
// SOLID: implements the `AccessFactsReader` port (Dependency Inversion); it only
// READS and shapes rows (Single Responsibility) — every allow/deny rule lives
// in the domain's allow paths. One transaction per decision, under one named,
// allowlisted system operation (the request's RLS scope does not exist yet).

import { Inject, Injectable } from "@nestjs/common";
import type { Permission, Prisma } from "@prisma/client";
import { epochMs, PermissionResourceSchema, type EpochMs, type PermissionPair } from "@workspace/shared";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { ACCESS_FACTS_OPERATION } from "../../../../platform/application/shared-system-operations";
import type { AccessFactsReader } from "../../application/ports/access-facts.port";
import type { AccessFacts, ActiveGrant, ActiveShare } from "../../domain/access/access-facts";
import { StoreScope } from "../../domain/access/store-scope";

interface FactsTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** Live rows only: not soft-deleted. */
const LIVE = { isDeleted: false };

/**
 * Permission rows the model gives meaning to. `OWN` / `RESOURCE` scoped rows meant "only your own
 * record" / "only through an ACL" in the old kernel; ownership and shares now say that, so such rows
 * never widen a role or grant into a blanket permission (they go in ADR 067 Phase 4).
 */
const MEANINGFUL_PERMISSION: Prisma.PermissionWhereInput = { isDeleted: false, scope: { notIn: ["OWN", "RESOURCE"] } };

const ROLE_PERMISSIONS = { rolePermissions: { where: { ...LIVE, permission: MEANINGFUL_PERMISSION }, include: { permission: true } } } satisfies Prisma.RoleInclude;

function pairOf(permission: Permission): PermissionPair {
	return { action: permission.action, resource: permission.resource };
}

function optionalEpoch(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

@Injectable()
export class PrismaAccessFactsReader implements AccessFactsReader {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: FactsTransactions,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public read(userId: string, tenantId: string | undefined): Promise<AccessFacts | null> {
		return this.transactions.withSystemOperation(
			{ operation: ACCESS_FACTS_OPERATION, reason: "Read the caller's standing for an access decision", actorUserId: userId },
			(tx) => (tenantId === undefined ? this.platformFacts(tx, userId) : this.tenantFacts(tx, userId, tenantId)),
		);
	}

	/** Platform roles and platform grants; a platform user reaches no store. */
	private async platformFacts(tx: Prisma.TransactionClient, userId: string): Promise<AccessFacts> {
		const [assignments, grants] = await Promise.all([
			tx.userRole.findMany({ where: { userId, ...LIVE, role: { ...LIVE, isActive: true, kind: "PLATFORM" } }, include: { role: { include: ROLE_PERMISSIONS } } }),
			this.grantsOf(tx, userId, null),
		]);
		return {
			rolePermissions: assignments.flatMap((assignment) => assignment.role.rolePermissions.map((row) => pairOf(row.permission))),
			stores: StoreScope.of([]),
			grants,
			shares: [],
		};
	}

	/** The ACTIVE membership's role, stores, grants and shares — or support access, or nothing. */
	private async tenantFacts(tx: Prisma.TransactionClient, userId: string, tenantId: string): Promise<AccessFacts | null> {
		const membership = await tx.membership.findFirst({
			where: { tenantId, userId, status: "ACTIVE", ...LIVE },
			include: {
				tenantRole: { include: ROLE_PERMISSIONS },
				// A soft-deleted store drops out of the scope: grants and shares limited to it go inert.
				locationScopes: { where: { ...LIVE, OR: [{ locationId: null }, { location: LIVE }] } },
			},
		});
		if (membership === null) {
			return (await this.hasSupportAccess(tx, userId, tenantId)) ? this.platformFacts(tx, userId) : null;
		}
		const role = membership.tenantRole;
		const roleApplies = !role.isDeleted && role.isActive && role.kind === "TENANT" && role.tenantId === tenantId;
		const [grants, shares] = await Promise.all([this.grantsOf(tx, userId, tenantId), this.sharesOf(tx, membership.id)]);
		return {
			rolePermissions: roleApplies ? role.rolePermissions.map((row) => pairOf(row.permission)) : [],
			stores: membership.locationScopes.some((scope) => scope.scopeType === "ALL_LOCATIONS")
				? StoreScope.all()
				: StoreScope.of(membership.locationScopes.flatMap((scope) => (scope.locationId === null ? [] : [scope.locationId]))),
			grants,
			shares,
		};
	}

	/** Grants in `tenantId` (`null`: platform grants). A grant limited to a soft-deleted store is inert. */
	private async grantsOf(tx: Prisma.TransactionClient, userId: string, tenantId: string | null): Promise<readonly ActiveGrant[]> {
		const rows = await tx.userPermission.findMany({
			where: { userId, tenantId, effect: "ALLOW", ...LIVE, permission: MEANINGFUL_PERMISSION, OR: [{ locationId: null }, { location: LIVE }] },
			include: { permission: true },
		});
		return rows.map((row) => ({ permission: pairOf(row.permission), locationId: row.locationId, expiresAt: optionalEpoch(row.expiresAt) }));
	}

	private async sharesOf(tx: Prisma.TransactionClient, membershipId: string): Promise<readonly ActiveShare[]> {
		const rows = await tx.resourceAcl.findMany({ where: { membershipId, ...LIVE, level: { not: null }, resourceId: { not: null } } });
		return rows.flatMap((row): ActiveShare[] => {
			const resource = PermissionResourceSchema.safeParse(row.resourceType);
			return !resource.success || row.level === null || row.resourceId === null
				? []
				: [{ resource: resource.data, resourceId: row.resourceId, level: row.level, expiresAt: optionalEpoch(row.expiresAt) }];
		});
	}

	/** An approved, unexpired, unrevoked support grant stands in for a membership (platform standing applies). */
	private async hasSupportAccess(tx: Prisma.TransactionClient, userId: string, tenantId: string): Promise<boolean> {
		const grant = await tx.supportAccessGrant.findFirst({
			where: { supportUserId: userId, tenantId, status: "ACTIVE", ...LIVE, revokedAt: null, expiresAt: { gt: BigInt(this.clock.now()) } },
			select: { id: true },
		});
		return grant !== null;
	}
}
