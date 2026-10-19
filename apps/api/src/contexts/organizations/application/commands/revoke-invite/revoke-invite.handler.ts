import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { RevokeInviteCommand } from "./revoke-invite.command";

/** PENDING → REVOKED as a compare-and-set, so it cannot race an accept; audited in the same transaction. */
@CommandHandler(RevokeInviteCommand)
export class RevokeInviteHandler implements ICommandHandler<RevokeInviteCommand, void> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RevokeInviteCommand): Promise<void> {
		const { actor, input } = command;
		const manager = requireUserActor(actor);
		const member = await this.directory.resolveMember(actor, input.orgSlug);
		await this.merchantAccess.assertCapability(actor, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageTeam });

		await this.uow.runSystemOperation("organization.invitation.revoke", actor, async (scope): Promise<void> => {
			const invite = await scope.invitations.findPendingTeamInvite(member.organizationId, input.inviteId);
			if (invite === null) {
				throw new NotFoundError();
			}
			invite.revoke(this.clock.now());
			await scope.invitations.save(invite);
			await scope.audit.record({
				organizationId: member.organizationId,
				actorUserId: manager.userId,
				policyVersion: member.policyVersion,
				action: "membership.invite_revoked",
				resourceType: "OrganizationInvitation",
				resourceId: invite.id,
				metadata: { email: invite.email },
			});
			scope.events.collectFrom(invite);
		});
	}
}
