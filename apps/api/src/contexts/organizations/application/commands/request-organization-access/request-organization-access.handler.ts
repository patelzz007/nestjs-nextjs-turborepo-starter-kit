import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OrganizationAccessRequestResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AccessRequest } from "../../../domain/aggregates/access-request.aggregate";
import { requireUserActor } from "../../organization-actor";
import { toAccessRequestResponse } from "../../organization-responses";
import type { OrganizationsScope } from "../../organizations-scope";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { ORGANIZATION_DIRECTORY, ORGANIZATIONS_UNIT_OF_WORK, TENANT_POLICY } from "../../ports/organizations.tokens";
import type { TenantPolicyPort } from "../../ports/tenant-policy.port";
import { RequestOrganizationAccessCommand } from "./request-organization-access.command";

@CommandHandler(RequestOrganizationAccessCommand)
export class RequestOrganizationAccessHandler implements ICommandHandler<RequestOrganizationAccessCommand, OrganizationAccessRequestResponse> {
	public constructor(
		@Inject(ORGANIZATIONS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OrganizationsScope>,
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(TENANT_POLICY) private readonly tenantPolicy: TenantPolicyPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestOrganizationAccessCommand): Promise<OrganizationAccessRequestResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const organizationId = await this.directory.resolveOrganizationId(input.orgSlug);
		const policyVersion = await this.tenantPolicy.activePolicyVersion(organizationId);

		return this.uow.runSystemOperation("organization.access_request.create", actor, async (scope): Promise<OrganizationAccessRequestResponse> => {
			const preconditions = {
				isMember: await scope.memberships.existsLive(organizationId, user.userId),
				hasPendingRequest: await scope.accessRequests.hasPending(organizationId, user.userId),
			};
			const request = AccessRequest.open(scope.accessRequests.nextId(), organizationId, user.userId, input.message ?? null, preconditions);
			const stored = await scope.accessRequests.add(request);
			await scope.audit.record({
				organizationId,
				actorUserId: user.userId,
				policyVersion,
				action: "membership.access_request_created",
				resourceType: "OrganizationAccessRequest",
				resourceId: stored.id,
			});
			scope.events.collectFrom(request);
			return toAccessRequestResponse(stored);
		});
	}
}
