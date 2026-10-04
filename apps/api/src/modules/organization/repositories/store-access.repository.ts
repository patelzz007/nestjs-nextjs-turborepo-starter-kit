import { Injectable } from "@nestjs/common";
import type { OrganizationLocationScopeType, OrganizationMembershipRole, PrismaClient } from "@prisma/client";

type DbTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Who removed access and when — written to every soft-deleted / revoked row. */
export interface AccessRemovalStamp {
	readonly actorUserId: string;
	readonly at: number;
}

/** A live organization membership with the location scope rows that decide which stores it covers. */
export interface MembershipWithScopes {
	readonly id: string;
	readonly userId: string;
	readonly role: OrganizationMembershipRole;
	readonly scopes: readonly { readonly scopeType: OrganizationLocationScopeType; readonly locationId: string | null }[];
}

/**
 * Every row that grants someone access to ONE store: store memberships,
 * member location-scope rows, terminals and store-scoped API keys. Used by
 * closing a store and by removing a member from a store, always inside the
 * caller's transaction. Scope rows are a pure junction (the audit row keeps
 * the history), so they are deleted; every business row is soft-deleted.
 */
@Injectable()
export class StoreAccessRepository {
	/** The store mirrored from `locationId` (read inside the caller's transaction); `null` when none exists. */
	public async findStoreIdByLocationInTx(tx: DbTx, locationId: string): Promise<string | null> {
		const store = await tx.store.findUnique({ where: { locationId }, select: { id: true } });
		return store?.id ?? null;
	}

	/** Soft-delete every live store membership of a store; returns how many. */
	public async softDeleteStoreMembershipsInTx(tx: DbTx, storeId: string, stamp: AccessRemovalStamp): Promise<number> {
		const result = await tx.storeMembership.updateMany({
			where: { storeId, isDeleted: false },
			data: { isDeleted: true, deletedAt: stamp.at, deletedBy: stamp.actorUserId, updatedAt: stamp.at },
		});
		return result.count;
	}

	/** Soft-delete one user's live membership in the store of `locationId`; returns how many rows changed (0 or 1). */
	public async softDeleteUserStoreMembershipInTx(tx: DbTx, locationId: string, userId: string, stamp: AccessRemovalStamp): Promise<number> {
		const result = await tx.storeMembership.updateMany({
			where: { userId, isDeleted: false, store: { locationId } },
			data: { isDeleted: true, deletedAt: stamp.at, deletedBy: stamp.actorUserId, updatedAt: stamp.at },
		});
		return result.count;
	}

	/** Remove every SELECTED member scope row that points at the location; returns how many. */
	public async deleteLocationScopesInTx(tx: DbTx, locationId: string): Promise<number> {
		const result = await tx.organizationMembershipLocationScope.deleteMany({ where: { locationId, scopeType: "SELECTED" } });
		return result.count;
	}

	/**
	 * Soft-delete the location's live terminals (clearing any live pairing
	 * code) and revoke every live API key of the location — the keys the
	 * terminals paired with and any other key scoped to the store. Returns the
	 * number of terminals and keys changed.
	 */
	public async removeTerminalsAndRevokeKeysInTx(
		tx: DbTx,
		organizationId: string,
		locationId: string,
		stamp: AccessRemovalStamp,
	): Promise<{ readonly terminalsRemoved: number; readonly apiKeysRevoked: number }> {
		const terminals = await tx.organizationTerminal.findMany({ where: { organizationId, locationId, isDeleted: false }, select: { id: true, apiKeyId: true } });
		const terminalKeyIds: string[] = terminals.flatMap((terminal): string[] => (terminal.apiKeyId === null ? [] : [terminal.apiKeyId]));

		const removed = await tx.organizationTerminal.updateMany({
			where: { id: { in: terminals.map((terminal): string => terminal.id) }, isDeleted: false },
			data: { isDeleted: true, deletedAt: stamp.at, deletedBy: stamp.actorUserId, pairingCodeHash: null, pairingCodeExpiresAt: null, updatedAt: stamp.at },
		});
		const revoked = await tx.organizationApiKey.updateMany({
			where: { organizationId, isDeleted: false, revokedAt: null, OR: [{ locationId }, { id: { in: terminalKeyIds } }] },
			data: { revokedAt: stamp.at, updatedAt: stamp.at },
		});
		return { terminalsRemoved: removed.count, apiKeysRevoked: revoked.count };
	}

	/** The live membership of `organizationId` read after taking its row lock, so two removals of the same member serialize. */
	public async findLiveMembershipForUpdateInTx(tx: DbTx, organizationId: string, membershipId: string): Promise<MembershipWithScopes | null> {
		await tx.$queryRaw`SELECT id FROM organization_memberships WHERE id = ${membershipId} AND organization_id = ${organizationId} AND is_deleted = false FOR UPDATE`;
		const row = await tx.organizationMembership.findFirst({
			where: { id: membershipId, organizationId, isDeleted: false },
			select: { id: true, userId: true, role: true, locationScopes: { select: { scopeType: true, locationId: true } } },
		});
		return row === null ? null : { id: row.id, userId: row.userId, role: row.role, scopes: row.locationScopes };
	}

	/** Delete one member's SELECTED scope row for a store; `true` when it existed (and was removed by THIS call). */
	public async deleteMemberScopeInTx(tx: DbTx, membershipId: string, locationId: string): Promise<boolean> {
		const result = await tx.organizationMembershipLocationScope.deleteMany({ where: { membershipId, locationId, scopeType: "SELECTED" } });
		return result.count === 1;
	}

	/** Location ids still covered by the member's SELECTED scope rows. */
	public async listMemberLocationIdsInTx(tx: DbTx, membershipId: string): Promise<string[]> {
		const rows = await tx.organizationMembershipLocationScope.findMany({ where: { membershipId, scopeType: "SELECTED" }, select: { locationId: true } });
		return rows.flatMap((row): string[] => (row.locationId === null ? [] : [row.locationId]));
	}
}
