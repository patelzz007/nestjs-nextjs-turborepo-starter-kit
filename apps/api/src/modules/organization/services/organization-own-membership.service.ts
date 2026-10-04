import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { OrganizationMembershipResponse, OrganizationOwnMembershipUpdateInput } from "@workspace/shared";
import { z } from "zod";

import { AuthorizationError, NotFoundError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { ProfileActor } from "../../auth/profile/profile-actor";
import { mapMembershipToResponse } from "../utils/organization-membership-mapper.util";
import { OrganizationAuditService } from "./organization-audit.service";
import type { OrganizationTeamActor } from "./organization-membership.service";

/** Error codes of updating one's own membership (clients branch on them). */
export const OWN_MEMBERSHIP_ERROR_CODES = {
	updateDuringImpersonation: "ORGANIZATION_MEMBERSHIP_UPDATE_DURING_IMPERSONATION",
} satisfies Readonly<Record<string, string>>;

/** Audit action of a member changing their own display name. */
export const OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION = "membership.display_name_updated";

/** Tenant-transaction purpose (`app.actor_purpose`) of the update. */
const OWN_MEMBERSHIP_UPDATE_PURPOSE = "organization.membership.update_own";

/** The caller's live membership row, read under its row lock. */
const LockedMembershipRowsSchema = z.array(z.object({ id: z.uuid(), display_name: z.string().nullable() })).max(1);

type OwnMembershipTransaction = Prisma.TransactionClient;

/**
 * A member's own, per-organization settings (today: the display name shown on
 * the team roster and in the organization context).
 *
 * Authorization: the caller is a live ACTIVE member of the organization
 * (resolved server-side from the route and the access token by
 * `OrganizationContextService.resolveBySlug`) and only ever changes THEIR OWN
 * row — the membership is selected by the token's user id, never by an id from
 * the request. No team capability is needed. An impersonation session cannot
 * change it: the display name is the member's self-representation, as with
 * `PATCH /auth/profile`.
 */
@Injectable()
export class OrganizationOwnMembershipService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
	) {}

	/**
	 * Set (or, with `null`, clear) the caller's display name. Runs in one tenant
	 * transaction: the caller's live membership row is locked (`FOR UPDATE`), so
	 * two concurrent edits serialize and each audit row records the value it
	 * actually replaced; a membership removed meanwhile is a 404.
	 */
	public async updateOwnMembership(
		session: ProfileActor["kind"],
		member: OrganizationTeamActor,
		input: OrganizationOwnMembershipUpdateInput,
	): Promise<OrganizationMembershipResponse> {
		if (session === "impersonated") {
			throw new AuthorizationError({
				code: OWN_MEMBERSHIP_ERROR_CODES.updateDuringImpersonation,
				message: "A membership's display name cannot be changed during impersonation.",
			});
		}

		return this.tenantTx.withTenantTransaction(
			{ userId: member.userId, organizationId: member.organizationId, purpose: OWN_MEMBERSHIP_UPDATE_PURPOSE, policyVersion: member.policyVersion },
			async (tx: OwnMembershipTransaction): Promise<OrganizationMembershipResponse> => {
				const [locked] = LockedMembershipRowsSchema.parse(
					await tx.$queryRaw`SELECT id, display_name FROM organization_memberships WHERE organization_id = ${member.organizationId} AND user_id = ${member.userId} AND is_deleted = false AND status = 'ACTIVE' FOR UPDATE`,
				);
				if (locked === undefined) {
					throw new NotFoundError();
				}

				const membership = await tx.organizationMembership.update({
					where: { id: locked.id },
					data: { displayName: input.displayName, updatedAt: BigInt(Date.now()) },
					include: { locationScopes: true },
				});
				await this.audit.recordInTx(tx, {
					organizationId: member.organizationId,
					actorUserId: member.userId,
					policyVersion: member.policyVersion,
					action: OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION,
					resourceType: "OrganizationMembership",
					resourceId: membership.id,
					metadata: { previousDisplayName: locked.display_name, displayName: input.displayName },
				});
				return mapMembershipToResponse(membership);
			},
		);
	}
}
