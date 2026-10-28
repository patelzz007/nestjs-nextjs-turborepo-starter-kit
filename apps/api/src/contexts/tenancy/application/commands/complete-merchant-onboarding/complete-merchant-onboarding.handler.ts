import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { buildMerchantSubmittedKybFields, type EpochMs, type MerchantOnboardingCompleteFieldsInput, type MerchantOnboardingCompleteResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ACCOUNT_PROVISIONING, type AccountProvisioningPort, type OnboardingAccountPlan } from "../../../../../platform/application/ports/account-provisioning.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Location } from "../../../domain/aggregates/location.aggregate";
import { Membership } from "../../../domain/aggregates/membership.aggregate";
import { MerchantInviteUnavailableError, OnboardingAccountRaceError } from "../../../domain/errors/tenants.errors";
import { assertOnboardingInviteNotExpired } from "../../../domain/policies/invitation-validity.policy";
import { merchantInviteNotFound } from "../../kyb-errors";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybReadPort, OnboardingInviteView } from "../../ports/kyb-read.port";
import { TENANT_INVITATION_ACCEPT_MERCHANT_ONBOARDING_OPERATION, INVITE_TOKENS, KYB_READ, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { CompleteMerchantOnboardingCommand } from "./complete-merchant-onboarding.command";

/** The app the merchant signs in to; its verify-email link points there. */
const MERCHANT_CLIENT_TYPE = "merchant";
/** Owner of a tenant the onboarding user already belongs to (a retry after the membership committed). */
const OWNER_ALREADY_MEMBER_MESSAGE = "You are already a member of this tenant";

/**
 * All or nothing. (1) Read-only, before the transaction: verify the existing account's password, or hash
 * the new account's (a wrong password stops here with nothing written). (2) ONE transaction: the new
 * account (referral code and default role included) or the existing account's name, the invite claim
 * (PENDING + unexpired → ACCEPTED, compare-and-set, so exactly one concurrent completion wins), the owner
 * membership, the business details, the primary and requested stores, activation and the audit rows. Any
 * failure rolls all of it back — no account is created and the invite stays PENDING for a retry. (3) Only
 * after the commit: the existing account's default role (its own RBAC transaction, idempotent) and the
 * verify-email message, so a failed onboarding sends no email.
 */
@CommandHandler(CompleteMerchantOnboardingCommand)
export class CompleteMerchantOnboardingHandler implements ICommandHandler<CompleteMerchantOnboardingCommand, MerchantOnboardingCompleteResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
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
		const plan: OnboardingAccountPlan = await this.accounts.checkOnboardingCredentials({ email: invite.email, password: input.password });

		const userId = await this.uow.runSystemOperation(TENANT_INVITATION_ACCEPT_MERCHANT_ONBOARDING_OPERATION, actor, async (scope): Promise<string> => {
			const claimed = await scope.invitations.findPendingOnboardingInviteByTokenHash(tokenHash);
			if (claimed?.id !== invite.id) {
				throw new MerchantInviteUnavailableError();
			}
			const userId = await this.ownerAccount(scope, plan, invite.email, input.fullName);
			const now = this.clock.now();
			claimed.accept(userId, now);
			await scope.invitations.save(claimed);
			scope.events.collectFrom(claimed);
			await this.ensureOwnerMembership(scope, invite.tenantId, userId, now);
			await this.applyBusinessDetails(scope, invite, input, now);
			await this.finalizeLocations(scope, invite, input, userId, now);
			await this.activate(scope, invite, userId, now);
			return userId;
		});

		if (plan.kind === "existing") {
			await this.accounts.ensureDefaultRole(userId);
		}
		await this.accounts.sendVerificationEmailIfUnverified(invite.email, MERCHANT_CLIENT_TYPE);
		return { tenantId: invite.tenantId, tenantSlug: invite.tenantSlug, businessName: invite.businessName, role: "OWNER" };
	}

	/**
	 * The owner's account, in the onboarding transaction: created (with its referral code and default role),
	 * or the existing one renamed. A concurrent registration of the same address rolls the onboarding back;
	 * the retry finds that account and verifies its password.
	 */
	private async ownerAccount(scope: TenantsScope, plan: OnboardingAccountPlan, email: string, fullName: string): Promise<string> {
		if (plan.kind === "existing") {
			await scope.accounts.renameAccount(plan.userId, fullName);
			return plan.userId;
		}
		const created = await scope.accounts.createAccount({ email, passwordHash: plan.passwordHash, fullName });
		if (created.kind === "email_taken") {
			throw new OnboardingAccountRaceError();
		}
		return created.userId;
	}

	/** A concurrent creator loses on the one-live-membership index, which rolls the whole onboarding back. */
	private async ensureOwnerMembership(scope: TenantsScope, tenantId: string, userId: string, now: EpochMs): Promise<void> {
		if (await scope.memberships.existsLive(tenantId, userId)) {
			return;
		}
		const owner = Membership.owner(scope.memberships.nextId(), tenantId, userId, now);
		await scope.memberships.add(owner, OWNER_ALREADY_MEMBER_MESSAGE);
		await scope.audit.record({
			tenantId,
			actorUserId: userId,
			action: "membership.owner_created",
			resourceType: "Membership",
			resourceId: owner.id,
		});
		scope.events.collectFrom(owner);
	}

	private async applyBusinessDetails(scope: TenantsScope, invite: OnboardingInviteView, input: MerchantOnboardingCompleteFieldsInput, now: EpochMs): Promise<void> {
		const verification = await scope.merchantVerifications.getForUpdate(invite.tenantId);
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
	 * stores are requested for review. All under the tenant's location lock.
	 */
	private async finalizeLocations(
		scope: TenantsScope,
		invite: OnboardingInviteView,
		input: MerchantOnboardingCompleteFieldsInput,
		userId: string,
		now: EpochMs,
	): Promise<void> {
		const { tenantId } = invite;
		await scope.locations.lockTenant(tenantId);
		const primaryDetails = { name: input.primaryLocation.name, addressText: input.primaryLocation.addressText, contactPhone: input.primaryLocation.contactPhone };
		const existingPrimary = await scope.locations.findLivePrimary(tenantId);
		let primaryId: string;
		if (existingPrimary === null) {
			const primary = Location.primaryFromOnboarding(scope.locations.nextId(), tenantId, primaryDetails, invite.city, userId, now);
			primaryId = (await scope.locations.add(primary)).id;
			scope.events.collectFrom(primary);
		} else {
			existingPrimary.completePrimaryFromOnboarding(primaryDetails, invite.city, userId, now);
			primaryId = (await scope.locations.save(existingPrimary)).id;
			scope.events.collectFrom(existingPrimary);
		}
		const auditBase = { tenantId, actorUserId: userId, resourceType: "Location" };
		await scope.audit.record({ ...auditBase, action: "tenant.location.primary_finalized", resourceId: primaryId });

		for (const draft of input.additionalLocations) {
			const requested = Location.requested(
				scope.locations.nextId(),
				tenantId,
				{ name: draft.name, addressText: draft.addressText, contactPhone: draft.contactPhone ?? null },
				invite.city,
				userId,
				now,
			);
			const stored = await scope.locations.add(requested);
			await scope.audit.record({ ...auditBase, action: "tenant.location.requested", resourceId: stored.id });
			scope.events.collectFrom(requested);
		}
	}

	/** PROVISIONING → ACTIVE (compare-and-set) with the business name the merchant confirmed. */
	private async activate(scope: TenantsScope, invite: OnboardingInviteView, userId: string, now: EpochMs): Promise<void> {
		const tenant = await scope.tenants.findById(invite.tenantId);
		if (tenant === null) {
			throw merchantInviteNotFound();
		}
		tenant.renameAtOnboarding(invite.businessName);
		tenant.activate(userId, now);
		await scope.tenants.save(tenant);
		const auditBase = { tenantId: invite.tenantId, actorUserId: userId, resourceType: "Tenant", resourceId: invite.tenantId };
		await scope.audit.record({ ...auditBase, action: "tenant.activated" });
		await scope.audit.record({ ...auditBase, action: "merchant.onboarding_completed", metadata: { inviteId: invite.id, userId } });
		scope.events.collectFrom(tenant);
	}
}
