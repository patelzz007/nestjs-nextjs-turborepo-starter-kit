import type { OrganizationMembership, OrganizationMembershipLocationScope, Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { Membership } from "../../domain/aggregates/membership.aggregate";
import { AlreadyMemberError } from "../../domain/errors/organizations.errors";
import type { MembershipRepository, PersistedMembership } from "../../domain/repositories/membership.repository";
import type { OrganizationsDb } from "./organization-db";
import { withUniqueViolationAs } from "./unique-violation";

type MembershipRow = OrganizationMembership & { readonly locationScopes: readonly Pick<OrganizationMembershipLocationScope, "scopeType" | "locationId">[] };

const SCOPES_SELECT = { locationScopes: { where: { isDeleted: false }, select: { scopeType: true, locationId: true } } } satisfies Prisma.OrganizationMembershipInclude;

export function toPersistedMembership(row: MembershipRow): PersistedMembership {
	return {
		id: row.id,
		organizationId: row.organizationId,
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
	public constructor(private readonly db: OrganizationsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async existsLive(organizationId: string, userId: string): Promise<boolean> {
		return (await this.db.organizationMembership.findFirst({ where: { organizationId, userId, isDeleted: false }, select: { id: true } })) !== null;
	}

	public async getLiveForUpdate(organizationId: string, membershipId: string): Promise<Membership | null> {
		await this.db.$queryRaw`SELECT id FROM "OrganizationMembership" WHERE id = ${membershipId} AND "organizationId" = ${organizationId} AND "isDeleted" = false FOR UPDATE`;
		return this.load({ id: membershipId, organizationId, isDeleted: false });
	}

	public async getOwnActiveForUpdate(organizationId: string, userId: string): Promise<Membership | null> {
		await this.db
			.$queryRaw`SELECT id FROM "OrganizationMembership" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId} AND "isDeleted" = false AND status = 'ACTIVE' FOR UPDATE`;
		return this.load({ organizationId, userId, isDeleted: false, status: "ACTIVE" });
	}

	public async add(membership: Membership, duplicateMessage: string): Promise<void> {
		await withUniqueViolationAs(
			async () =>
				this.db.organizationMembership.create({
					data: {
						id: membership.id,
						organizationId: membership.organizationId,
						userId: membership.userId,
						role: membership.role,
						status: membership.status,
						locationScopes: {
							create: membership.scope.toRows().map((row) => ({ organizationId: membership.organizationId, scopeType: row.scopeType, locationId: row.locationId })),
						},
					},
				}),
			() => new AlreadyMemberError(duplicateMessage),
		);
	}

	public async save(membership: Membership): Promise<PersistedMembership> {
		for (const change of membership.changes) {
			if (change.kind === "renamed") {
				await this.db.organizationMembership.update({ where: { id: membership.id }, data: { displayName: change.displayName, updatedAt: BigInt(Date.now()) } });
			}
			if (change.kind === "removed_from_store") {
				// Soft-deleted like every business row: the scope history stays, and access reads only live rows.
				await this.db.organizationMembershipLocationScope.updateMany({
					where: { membershipId: membership.id, locationId: change.locationId, scopeType: "SELECTED", isDeleted: false },
					data: { isDeleted: true, deletedAt: change.removedAt, deletedBy: change.removedByUserId, updatedAt: change.removedAt },
				});
				await this.db.storeMembership.updateMany({
					where: { userId: membership.userId, isDeleted: false, store: { locationId: change.locationId } },
					data: { isDeleted: true, deletedAt: change.removedAt, deletedBy: change.removedByUserId, updatedAt: change.removedAt },
				});
			}
		}
		const row = await this.db.organizationMembership.findUniqueOrThrow({ where: { id: membership.id }, include: SCOPES_SELECT });
		return toPersistedMembership(row);
	}

	private async load(where: {
		readonly id?: string;
		readonly organizationId: string;
		readonly userId?: string;
		readonly isDeleted: false;
		readonly status?: "ACTIVE";
	}): Promise<Membership | null> {
		const row = await this.db.organizationMembership.findFirst({ where: { ...where }, include: SCOPES_SELECT });
		return row === null ? null : Membership.rehydrate(toPersistedMembership(row));
	}
}
