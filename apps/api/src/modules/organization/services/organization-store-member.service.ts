import { Injectable } from "@nestjs/common";
import { epochMs, MERCHANT_CAPABILITY, type OrganizationMemberStoreRemoveInput, type OrganizationMemberStoreRemoveResponse } from "@workspace/shared";

import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { StoreAccessRepository } from "../repositories/store-access.repository";
import { STORE_OUT_OF_SCOPE_CODE } from "./organization-location.service";
import { OrganizationAuditService } from "./organization-audit.service";
import { OrganizationRewardAuthService } from "./organization-reward-auth.service";
import type { OrganizationTeamActor } from "./organization-membership.service";

/** Error codes of removing a member from a store (clients branch on them). */
export const STORE_MEMBER_ERROR_CODES = {
	ownerProtected: "ORGANIZATION_OWNER_PROTECTED",
	allLocationsMember: "ORGANIZATION_MEMBER_COVERS_ALL_STORES",
	lastStore: "ORGANIZATION_MEMBER_LAST_STORE",
} satisfies Readonly<Record<string, string>>;

/** Removes one team member from one store, atomically with its audit row. */
@Injectable()
export class OrganizationStoreMemberService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly storeAccess: StoreAccessRepository,
	) {}

	/**
	 * Remove `membershipId` from the store of `locationId`: deletes the member's
	 * SELECTED scope row and soft-deletes their store membership. Needs
	 * `merchant:manage_team` and a location scope that covers the store. The
	 * OWNER is protected, a member who covers ALL stores cannot be trimmed to
	 * one, and a member left with no store at all is refused unless the request
	 * says `allowNoStores`. The member row is locked first, so two removals of
	 * the same member cannot both pass the last-store check.
	 */
	public async removeFromStore(
		actor: OrganizationTeamActor,
		membershipId: string,
		locationId: string,
		input: OrganizationMemberStoreRemoveInput,
	): Promise<OrganizationMemberStoreRemoveResponse> {
		await this.organizationRewardAuth.requireMembershipCapability(
			{ userId: actor.userId, organizationId: actor.organizationId, role: actor.role },
			MERCHANT_CAPABILITY.manageTeam,
		);
		if (actor.locationScopeType !== "ALL_LOCATIONS" && !actor.locationIds.includes(locationId)) {
			throw new AuthorizationError({ code: STORE_OUT_OF_SCOPE_CODE, message: "This store is outside your location scope" });
		}

		return this.tenantTx.withSystemOperation(
			{ operation: "organization.membership.remove_from_store", reason: "Team manager removed a member from a store", actorUserId: actor.userId },
			async (tx) => {
				const target = await this.storeAccess.findLiveMembershipForUpdateInTx(tx, actor.organizationId, membershipId);
				if (target === null) {
					throw new NotFoundError();
				}
				if (target.role === "OWNER") {
					throw new ConflictError({ code: STORE_MEMBER_ERROR_CODES.ownerProtected, message: "The organization owner cannot be removed from a store" });
				}
				if (target.scopes.some((scope) => scope.scopeType === "ALL_LOCATIONS")) {
					throw new ConflictError({
						code: STORE_MEMBER_ERROR_CODES.allLocationsMember,
						message: "This member has access to every store; narrow their access to selected stores first",
					});
				}
				if (!(await this.storeAccess.deleteMemberScopeInTx(tx, target.id, locationId))) {
					throw new NotFoundError();
				}

				const remainingLocationIds = await this.storeAccess.listMemberLocationIdsInTx(tx, target.id);
				if (remainingLocationIds.length === 0 && !input.allowNoStores) {
					// Roll the whole transaction back: nothing has been committed.
					throw new ConflictError({
						code: STORE_MEMBER_ERROR_CODES.lastStore,
						message: "This is the member's last store; set allowNoStores to remove them from it anyway",
					});
				}

				const stamp = { actorUserId: actor.userId, at: Date.now() };
				await this.storeAccess.softDeleteUserStoreMembershipInTx(tx, locationId, target.userId, stamp);
				await this.audit.recordInTx(tx, {
					organizationId: actor.organizationId,
					actorUserId: actor.userId,
					policyVersion: actor.policyVersion,
					action: "membership.removed_from_store",
					resourceType: "OrganizationMembership",
					resourceId: target.id,
					metadata: { locationId, memberUserId: target.userId, allowNoStores: input.allowNoStores, remainingStores: remainingLocationIds.length },
				});

				return { membershipId: target.id, locationId, removedAt: epochMs(stamp.at), remainingLocationIds };
			},
		);
	}
}
