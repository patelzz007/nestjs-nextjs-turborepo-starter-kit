import type { Membership as MembershipRecord, MembershipLocationScope, Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { Membership } from "../../domain/aggregates/membership.aggregate";
import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { AlreadyMemberError } from "../../domain/errors/tenants.errors";
import type { MembershipRepository, PersistedMembership } from "../../domain/repositories/membership.repository";
import type { TenantsDb } from "./tenant-db";
import { TenantRoleCopies } from "../../../authorization/public-api";
import { withUniqueViolationAs } from "./unique-violation";
import { LoadTestUserConfinedError } from "../../../../platform/domain/errors/load-test-user-confined.error";

type MembershipRow = MembershipRecord & { readonly locationScopes: readonly Pick<MembershipLocationScope, "scopeType" | "locationId">[] };

const SCOPES_SELECT = { locationScopes: { where: { isDeleted: false }, select: { scopeType: true, locationId: true } } } satisfies Prisma.MembershipInclude;

export function toPersistedMembership(row: MembershipRow): PersistedMembership {
	return {
		id: row.id,
		tenantId: row.tenantId,
		userId: row.userId,
		role: row.role,
		status: row.status,
		displayName: row.displayName,
		scopeRows: row.locationScopes.map((scope) => ({ scopeType: scope.scopeType, locationId: scope.locationId })),
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

export class PrismaMembershipRepository implements MembershipRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async existsLive(tenantId: string, userId: string): Promise<boolean> {
		return (await this.db.membership.findFirst({ where: { tenantId, userId, isDeleted: false }, select: { id: true } })) !== null;
	}

	/** A load-test user joins only the Load Test tenant (ADR 068). */
	private async assertLoadTestConfinement(userId: string, tenantId: string): Promise<void> {
		const user = await this.db.user.findFirst({ where: { id: userId }, select: { isLoadTestUser: true } });
		if (user?.isLoadTestUser !== true) {
			return;
		}
		const tenant = await this.db.tenant.findFirst({ where: { id: tenantId }, select: { isLoadTest: true } });
		if (tenant?.isLoadTest !== true) {
			throw new LoadTestUserConfinedError(userId);
		}
	}

	public async getLiveForUpdate(tenantId: string, membershipId: string): Promise<Membership | null> {
		await this.db.$queryRaw`SELECT id FROM "Membership" WHERE id = ${membershipId} AND "tenantId" = ${tenantId} AND "isDeleted" = false FOR UPDATE`;
		return this.load({ id: membershipId, tenantId, isDeleted: false });
	}

	public async getOwnLiveForUpdate(tenantId: string, userId: string): Promise<Membership | null> {
		await this.db.$queryRaw`SELECT id FROM "Membership" WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND "isDeleted" = false FOR UPDATE`;
		return this.load({ tenantId, userId, isDeleted: false });
	}

	public async getOwnActiveForUpdate(tenantId: string, userId: string): Promise<Membership | null> {
		await this.db.$queryRaw`SELECT id FROM "Membership" WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND "isDeleted" = false AND status = 'ACTIVE' FOR UPDATE`;
		return this.load({ tenantId, userId, isDeleted: false, status: "ACTIVE" });
	}

	public async add(membership: Membership, duplicateMessage: string): Promise<void> {
		await this.assertLoadTestConfinement(membership.userId, membership.tenantId);
		// A member holds the tenant's own copy of their role's template (ADR 067).
		const roleId = await new TenantRoleCopies(this.db).roleIdFor(membership.tenantId, membership.role);
		await withUniqueViolationAs(
			async () =>
				this.db.membership.create({
					data: {
						id: membership.id,
						tenantId: membership.tenantId,
						userId: membership.userId,
						roleId,
						role: membership.role,
						status: membership.status,
						locationScopes: {
							// The scope's tenant comes from this membership through the composite (tenantId, membershipId)
							// key, so it is not repeated here (multi-tenancy plan §7).
							create: membership.scope
								.toRows()
								.map((row): Prisma.MembershipLocationScopeUncheckedCreateWithoutMembershipInput => ({ scopeType: row.scopeType, locationId: row.locationId })),
						},
					},
				}),
			() => new AlreadyMemberError(duplicateMessage),
		);
	}

	public async save(membership: Membership): Promise<PersistedMembership> {
		for (const change of membership.changes) {
			if (change.kind === "renamed") {
				await this.db.membership.update({ where: { id: membership.id }, data: { displayName: change.displayName, updatedAt: BigInt(Date.now()) } });
			}
			if (change.kind === "left") {
				const left = { isDeleted: true, deletedAt: change.leftAt, deletedBy: membership.userId, updatedAt: change.leftAt };
				await this.db.membershipLocationScope.updateMany({ where: { membershipId: membership.id, isDeleted: false }, data: left });
				const written = await this.db.membership.updateMany({ where: { id: membership.id, isDeleted: false }, data: left });
				if (written.count !== 1) {
					throw new ConcurrentModificationError(membership.id);
				}
			}
			if (change.kind === "removed_from_location") {
				// Soft-deleted like every business row: the scope history stays, and access (with the location
				// role the row carries) reads only live rows.
				await this.db.membershipLocationScope.updateMany({
					where: { membershipId: membership.id, locationId: change.locationId, scopeType: "SELECTED", isDeleted: false },
					data: { isDeleted: true, deletedAt: change.removedAt, deletedBy: change.removedByUserId, updatedAt: change.removedAt },
				});
			}
		}
		const row = await this.db.membership.findFirstOrThrow({ where: { id: membership.id }, include: SCOPES_SELECT });
		return toPersistedMembership(row);
	}

	private async load(where: {
		readonly id?: string;
		readonly tenantId: string;
		readonly userId?: string;
		readonly isDeleted: false;
		readonly status?: "ACTIVE";
	}): Promise<Membership | null> {
		const row = await this.db.membership.findFirst({ where: { ...where }, include: SCOPES_SELECT });
		return row === null ? null : Membership.rehydrate(toPersistedMembership(row));
	}
}
