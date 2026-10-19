import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { buildMerchantSubmittedKybFields, type EpochMs, type MerchantOnboardingCompleteFieldsInput, type MerchantOnboardingCompleteResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ACCOUNT_PROVISIONING, type AccountProvisioningPort } from "../../../../../platform/application/ports/account-provisioning.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { Membership } from "../../../domain/aggregates/membership.aggregate";
import { MerchantInviteUnavailableError } from "../../../domain/errors/organizations.errors";
import { assertOnboardingInviteNotExpired } from "../../../domain/policies/invitation-validity.policy";
import { merchantInviteNotFound } from "../../kyb-errors";
import type { OrganizationsScope } from "../../organizations-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybReadPort, OnboardingInviteView } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_READ, ORGANIZATIONS_UNIT_OF_WORK } from "../../ports/organizations.tokens";
import { CompleteMerchantOnboardingCommand } from "./complete-merchant-onboarding.command";

/** The app the merchant signs in to; its verify-email link points there. */
const MERCHANT_CLIENT_TYPE = "merchant";
/** Owner of an organization the onboarding user already belongs to (a retry after the membership committed). */
const OWNER_ALREADY_MEMBER_MESSAGE = "You are already a member of this organization";

/**
 * Two phases. (1) The account, outside the transaction and idempotent: create
 * it, or verify the existing one's password. (2) ONE transaction: claim the
 * invite (PENDING + unexpired → ACCEPTED, compare-and-set, so exactly one
 * concurrent completion wins), the owner membership, the business details,
 * the primary and requested stores, activation and the audit rows. Any
 * failure rolls all of it back and leaves the invite PENDING for a retry.
 */
@CommandHandler(CompleteMerchantOnboardingCommand)
export class CompleteMerchantOnboardingHandler implements ICommandHandler<CompleteMerchantOnboardingCommand, MerchantOnboardingCompleteResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(ACCOUNT_PROVISIONING) private readonly accounts: AccountProvisioningPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CompleteMerchantOnboardingCommand): Promise<MerchantOnboardingCompleteResponse> {
		const { actor, input } = command;
		const tokenHash = this.tokens.hash(input.token);
		const invite = await this.kyb.findOnboardingInvite(tokenHash, ["PENDING"]);
		if (invite === null) {
			throw merchantInviteNotFound();
		}
		assertOnboardingInviteNotExpired(invite.expiresAt, this.clock.now());
		const userId = await this.accounts.resolveOnboardingAccount({ email: invite.email, password: input.password, fullName: input.fullName });
		await this.accounts.sendVerificationEmailIfUnverified(invite.email, MERCHANT_CLIENT_TYPE);

		await this.uow.runSystemOperation("organization.invitation.accept_merchant_onboarding", actor, async (scope): Promise<void> => {
			const claimed = await scope.invitations.findPendingOnboardingInviteByTokenHash(tokenHash);
			if (claimed?.id !== invite.id) {
				throw new MerchantInviteUnavailableError();
			}
			const now = this.clock.now();
			claimed.accept(userId, now);
			await scope.invitations.save(claimed);
			scope.events.collectFrom(claimed);
			await this.ensureOwnerMembership(scope, invite.organizationId, userId, now);
			await this.applyBusinessDetails(scope, invite, input, now);
			await this.finalizeLocations(scope, invite, input, userId, now);
			await this.activate(scope, invite, userId, now);
		});

		return { organizationId: invite.organizationId, organizationSlug: invite.organizationSlug, businessName: invite.businessName, role: "OWNER" };
	}

	/** A concurrent creator loses on the one-live-membership index, which rolls the whole onboarding back. */
	private async ensureOwnerMembership(scope: OrganizationsScope, organizationId: string, userId: string, now: EpochMs): Promise<void> {
		if (await scope.memberships.existsLive(organizationId, userId)) {
			return;
		}
		const owner = Membership.owner(scope.memberships.nextId(), organizationId, userId, now);
		await scope.memberships.add(owner, OWNER_ALREADY_MEMBER_MESSAGE);
		await scope.audit.record({
			organizationId,
			actorUserId: userId,
			policyVersion: await scope.tenantPolicies.activePolicyVersion(organizationId),
			action: "membership.owner_created",
			resourceType: "OrganizationMembership",
			resourceId: owner.id,
		});
		scope.events.collectFrom(owner);
	}

	private async applyBusinessDetails(scope: OrganizationsScope, invite: OnboardingInviteView, input: MerchantOnboardingCompleteFieldsInput, now: EpochMs): Promise<void> {
		const verification = await scope.merchantVerifications.getForUpdate(invite.organizationId);
		if (verification === null) {
			throw merchantInviteNotFound();
		}
		verification.applyOnboardingApplication(
			{
				legalName: input.legalName.trim(),
				addressText: input.primaryLocation.addressText.trim(),
				contactPhone: input.primaryLocation.contactPhone.trim(),
				kybFields: buildMerchantSubmittedKybFields(input),
				category: input.category,
			},
			now,
		);
		await scope.merchantVerifications.save(verification);
		scope.events.collectFrom(verification);
	}

	/**
	 * The primary store is created HERE, from the merchant's submitted address
	 * (provisioning never creates an address-less primary); the additional
	 * stores are requested for review. All under the organization's location lock.
	 */
	private async finalizeLocations(
		scope: OrganizationsScope,
		invite: OnboardingInviteView,
		input: MerchantOnboardingCompleteFieldsInput,
		userId: string,
		now: EpochMs,
	): Promise<void> {
		const { organizationId } = invite;
		const policyVersion = await scope.tenantPolicies.activePolicyVersion(organizationId);
		await scope.locations.lockOrganization(organizationId);
		const primaryDetails = { name: input.primaryLocation.name, addressText: input.primaryLocation.addressText, contactPhone: input.primaryLocation.contactPhone };
		const existingPrimary = await scope.locations.findLivePrimary(organizationId);
		let primaryId: string;
		if (existingPrimary === null) {
			const primary = Location.primaryFromOnboarding(scope.locations.nextId(), organizationId, primaryDetails, invite.city, userId, now);
			primaryId = (await scope.locations.add(primary)).id;
			scope.events.collectFrom(primary);
		} else {
			existingPrimary.completePrimaryFromOnboarding(primaryDetails, invite.city, userId, now);
			primaryId = (await scope.locations.save(existingPrimary)).id;
			scope.events.collectFrom(existingPrimary);
		}
		const auditBase = { organizationId, actorUserId: userId, policyVersion, resourceType: "OrganizationLocation" };
		await scope.audit.record({ ...auditBase, action: "organization.location.primary_finalized", resourceId: primaryId });

		for (const draft of input.additionalLocations) {
			const requested = Location.requested(
				scope.locations.nextId(),
				organizationId,
				{ name: draft.name, addressText: draft.addressText, contactPhone: draft.contactPhone ?? null },
				invite.city,
				userId,
				now,
			);
			const stored = await scope.locations.add(requested);
			await scope.audit.record({ ...auditBase, action: "organization.location.requested", resourceId: stored.id });
			scope.events.collectFrom(requested);
		}
	}

	/** PROVISIONING → ACTIVE (compare-and-set) with the business name the merchant confirmed. */
	private async activate(scope: OrganizationsScope, invite: OnboardingInviteView, userId: string, now: EpochMs): Promise<void> {
		const organization = await scope.organizations.findById(invite.organizationId);
		if (organization === null) {
			throw merchantInviteNotFound();
		}
		organization.renameAtOnboarding(invite.businessName);
		organization.activate(userId, now);
		await scope.organizations.save(organization);
		const policyVersion = await scope.tenantPolicies.activePolicyVersion(invite.organizationId);
		const auditBase = { organizationId: invite.organizationId, actorUserId: userId, policyVersion, resourceType: "Organization", resourceId: invite.organizationId };
		await scope.audit.record({ ...auditBase, action: "organization.activated" });
		await scope.audit.record({ ...auditBase, action: "merchant.onboarding_completed", metadata: { inviteId: invite.id, userId } });
		scope.events.collectFrom(organization);
	}
}
