import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { TENANT_PROVISIONING_GATE, type TenantProvisioningGate } from "../../../../../platform/application/tenancy/tenant-provisioning.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { Tenant } from "../../../domain/aggregates/tenant.aggregate";
import { TenantProvisioningDisabledError } from "../../../domain/errors/tenants.errors";
import { ONBOARDING_INVITE_TTL_DAYS } from "../../../domain/policies/invitation-validity.policy";
import { auditActorId } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, TENANTS_UNIT_OF_WORK, PROVISION_ADMIN_MERCHANT_INVITE_OPERATION } from "../../ports/tenants.tokens";
import { ProvisionMerchantFromAdminInviteCommand, type MerchantInviteCreated } from "./provision-merchant-from-admin-invite.command";

/**
 * The tenant (slug derived from the business name), its merchant
 * profile (the category is left for the merchant to state at onboarding), the
 * OWNER onboarding invite, default tenant policies, the audit row and the
 * email request, in one unit of work. The invite URL carries a live token: it
 * leaves the process only inside the email.
 */
@CommandHandler(ProvisionMerchantFromAdminInviteCommand)
export class ProvisionMerchantFromAdminInviteHandler implements ICommandHandler<ProvisionMerchantFromAdminInviteCommand, MerchantInviteCreated> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(TENANT_PROVISIONING_GATE) private readonly provisioning: TenantProvisioningGate,
	) {}

	public async execute(command: ProvisionMerchantFromAdminInviteCommand): Promise<MerchantInviteCreated> {
		// A single-tenant deployment serves only its seeded tenant: refused before any token or row exists.
		if (!this.provisioning.isProvisioningAllowed()) {
			throw new TenantProvisioningDisabledError();
		}
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const token = this.tokens.issue();

		return this.uow.runSystemOperation(PROVISION_ADMIN_MERCHANT_INVITE_OPERATION, actor, async (scope): Promise<MerchantInviteCreated> => {
			const now = this.clock.now();
			const tenant = Tenant.provision(
				scope.tenants.nextId(),
				await scope.tenants.allocateSlug(input.businessName),
				input.businessName,
				{ category: null, city: input.city, contactEmail: input.email },
				adminUserId,
				"Platform admin invite created",
				now,
			);
			await scope.tenants.add(tenant);
			const invite = Invitation.issueOnboardingInvite(scope.invitations.nextId(), tenant.id, input.email, "OWNER", token.tokenHash, adminUserId, now);
			await scope.invitations.add(invite);
			await scope.tenantPolicies.seedDefaultPolicies(tenant.id, adminUserId);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(tenant.id),
				action: "tenant.provisioned",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { source: "admin_merchant_invite", inviteId: invite.id },
			});
			await scope.emails.sendMerchantInvite({
				invitationId: invite.id,
				to: input.email,
				businessName: input.businessName,
				city: input.city,
				rawToken: token.rawToken,
				expiresInDays: ONBOARDING_INVITE_TTL_DAYS,
			});
			scope.events.collectFrom(tenant);
			scope.events.collectFrom(invite);
			return { inviteId: invite.id, inviteToken: token.rawToken, expiresAt: invite.expiresAt };
		});
	}
}
