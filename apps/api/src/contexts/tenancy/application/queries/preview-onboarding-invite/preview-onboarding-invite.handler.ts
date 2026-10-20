import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantOnboardingInvitePreview } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ACCOUNT_PROVISIONING, type AccountProvisioningPort } from "../../../../../platform/application/ports/account-provisioning.port";
import { assertOnboardingInviteNotExpired } from "../../../domain/policies/invitation-validity.policy";
import { merchantInviteNotFound } from "../../kyb-errors";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_READ } from "../../ports/tenants.tokens";
import { PreviewOnboardingInviteQuery } from "./preview-onboarding-invite.query";

@QueryHandler(PreviewOnboardingInviteQuery)
export class PreviewOnboardingInviteHandler implements IQueryHandler<PreviewOnboardingInviteQuery, MerchantOnboardingInvitePreview> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(ACCOUNT_PROVISIONING) private readonly accounts: AccountProvisioningPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: PreviewOnboardingInviteQuery): Promise<MerchantOnboardingInvitePreview> {
		const invite = await this.kyb.findOnboardingInvite(this.tokens.hash(query.input.token), ["PENDING"]);
		if (invite === null) {
			throw merchantInviteNotFound();
		}
		assertOnboardingInviteNotExpired(invite.expiresAt, this.clock.now());
		return {
			email: invite.email,
			businessName: invite.businessName,
			city: invite.city,
			expiresAt: invite.expiresAt,
			hasExistingAccount: await this.accounts.accountExists(invite.email),
		};
	}
}
