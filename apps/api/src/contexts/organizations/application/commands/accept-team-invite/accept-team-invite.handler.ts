import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OrganizationTeamInviteAcceptResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { requireUserActor } from "../../organization-actor";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { acceptTeamInviteInScope, invalidTeamInviteLink } from "../../team-invite-acceptance";
import { AcceptTeamInviteCommand } from "./accept-team-invite.command";

/** The invite must be pending, unexpired and addressed to the signed-in user's email; one membership per user. */
@CommandHandler(AcceptTeamInviteCommand)
export class AcceptTeamInviteHandler implements ICommandHandler<AcceptTeamInviteCommand, OrganizationTeamInviteAcceptResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: AcceptTeamInviteCommand): Promise<OrganizationTeamInviteAcceptResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const tokenHash = this.tokens.hash(input.token);

		const organizationSlug = await this.uow.runSystemOperation("organization.membership.accept", actor, async (scope): Promise<string> => {
			const invite = await scope.invitations.findPendingTeamInviteByTokenHash(tokenHash);
			if (invite === null) {
				throw invalidTeamInviteLink();
			}
			const now = this.clock.now();
			invite.assertTeamInviteUsable(now);
			invite.assertAcceptableBy(input.email);
			return acceptTeamInviteInScope(scope, invite, user.userId, now);
		});

		return { organizationSlug, message: "Invitation accepted" };
	}
}
