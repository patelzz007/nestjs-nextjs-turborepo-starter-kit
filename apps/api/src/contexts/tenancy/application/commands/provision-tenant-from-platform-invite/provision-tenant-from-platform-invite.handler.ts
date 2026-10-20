import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminTenantInviteCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { TENANT_PROVISIONING_GATE, type TenantProvisioningGate } from "../../../../../platform/application/tenancy/tenant-provisioning.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Invitation } from "../../../domain/aggregates/invitation.aggregate";
import { Tenant } from "../../../domain/aggregates/tenant.aggregate";
import { TenantProvisioningDisabledError } from "../../../domain/errors/tenants.errors";
import { auditActorId } from "../../tenant-actor";
import type { TenantsScope } from "../../tenants-scope";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import { INVITE_TOKENS, TENANTS_UNIT_OF_WORK, PROVISION_PLATFORM_INVITE_OPERATION } from "../../ports/tenants.tokens";
import { ProvisionTenantFromPlatformInviteCommand } from "./provision-tenant-from-platform-invite.command";

/**
 * The tenant (PROVISIONING, no location yet), its merchant profile,
 * placement, default tenant policies, onboarding invite and audit
 * row in one transaction. Each call mints a new token that exists only in the
 * response; a duplicate slug is 409. Retries are safe through `Idempotency-Key` (D24).
 */
@CommandHandler(ProvisionTenantFromPlatformInviteCommand)
export class ProvisionTenantFromPlatformInviteHandler implements ICommandHandler<ProvisionTenantFromPlatformInviteCommand, AdminTenantInviteCreatedResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(TENANT_PROVISIONING_GATE) private readonly provisioning: TenantProvisioningGate,
	) {}

	public async execute(command: ProvisionTenantFromPlatformInviteCommand): Promise<AdminTenantInviteCreatedResponse> {
		// A single-tenant deployment serves only its seeded tenant: refused before any token or row exists.
		if (!this.provisioning.isProvisioningAllowed()) {
			throw new TenantProvisioningDisabledError();
		}
		const { actor, input } = command;
		const adminUserId = auditActorId(actor);
		const token = this.tokens.issue();

		return this.uow.runSystemOperation(PROVISION_PLATFORM_INVITE_OPERATION, actor, async (scope): Promise<AdminTenantInviteCreatedResponse> => {
			const now = this.clock.now();
			const tenant = Tenant.provision(
				scope.tenants.nextId(),
				input.slug,
				input.displayName,
				{ category: input.category, city: input.city, contactEmail: input.email },
				adminUserId,
				"Platform invite created",
				now,
			);
			await scope.tenants.add(tenant);
			const invite = Invitation.issueOnboardingInvite(scope.invitations.nextId(), tenant.id, input.email, input.intendedRole, token.tokenHash, adminUserId, now);
			await scope.invitations.add(invite);
			await scope.tenantPolicies.seedDefaultPolicies(tenant.id, adminUserId);
			await scope.audit.record({
				tenantId: tenant.id,
				actorUserId: adminUserId,
				policyVersion: await scope.tenantPolicies.activePolicyVersion(tenant.id),
				action: "tenant.provisioned",
				resourceType: "Tenant",
				resourceId: tenant.id,
				metadata: { source: "platform_invite", inviteId: invite.id, intendedRole: input.intendedRole },
			});
			scope.events.collectFrom(tenant);
			scope.events.collectFrom(invite);
			return { tenantId: tenant.id, inviteToken: token.rawToken };
		});
	}
}
