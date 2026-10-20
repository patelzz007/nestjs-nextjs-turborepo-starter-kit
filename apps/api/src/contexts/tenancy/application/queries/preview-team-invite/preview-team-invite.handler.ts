import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TenantTeamInvitePreview } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ACCOUNT_PROVISIONING, type AccountProvisioningPort } from "../../../../../platform/application/ports/account-provisioning.port";
import { assertTeamInviteNotExpired } from "../../../domain/policies/invitation-validity.policy";
import { notFound } from "../../tenant-actor";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, TEAM_READ } from "../../ports/tenants.tokens";
import type { TeamReadPort } from "../../ports/team-read.port";
import { invalidTeamInviteLink } from "../../team-invite-acceptance";
import { PreviewTeamInviteQuery } from "./preview-team-invite.query";

@QueryHandler(PreviewTeamInviteQuery)
export class PreviewTeamInviteHandler implements IQueryHandler<PreviewTeamInviteQuery, TenantTeamInvitePreview> {
	public constructor(
		@Inject(TEAM_READ) private readonly team: TeamReadPort,
		@Inject(ACCOUNT_PROVISIONING) private readonly accounts: AccountProvisioningPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: PreviewTeamInviteQuery): Promise<TenantTeamInvitePreview> {
		const invite = await this.team.findPendingInvitePreview(this.tokens.hash(query.input.token));
		if (invite === null) {
			throw invalidTeamInviteLink();
		}
		assertTeamInviteNotExpired(invite.expiresAt, this.clock.now());
		const hasExistingAccount = await this.accounts.accountExists(invite.email);
		if (invite.tenant === null) {
			throw notFound();
		}
		return {
			email: invite.email,
			tenantDisplayName: invite.tenant.displayName,
			tenantSlug: invite.tenant.slug,
			intendedRole: invite.intendedRole,
			locationScopeType: invite.locationScopeType,
			locationIds: invite.locations.map((location) => location.id),
			locationLabels: invite.locations.map((location) => ({ id: location.id, name: location.name })),
			expiresAt: invite.expiresAt,
			hasExistingAccount,
		};
	}
}
