import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TenantAccessRequestResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AccessRequest } from "../../../domain/aggregates/access-request.aggregate";
import { requireUserActor } from "../../tenant-actor";
import { toAccessRequestResponse } from "../../tenant-responses";
import type { TenantsScope } from "../../tenants-scope";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { TENANT_DIRECTORY, TENANTS_UNIT_OF_WORK } from "../../ports/tenants.tokens";
import { RequestTenantAccessCommand } from "./request-tenant-access.command";

@CommandHandler(RequestTenantAccessCommand)
export class RequestTenantAccessHandler implements ICommandHandler<RequestTenantAccessCommand, TenantAccessRequestResponse> {
	public constructor(
		@Inject(TENANTS_UNIT_OF_WORK) private readonly uow: UnitOfWork<TenantsScope>,
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestTenantAccessCommand): Promise<TenantAccessRequestResponse> {
		const { actor, input } = command;
		const user = requireUserActor(actor);
		const tenantId = await this.directory.resolveTenantId(input.tenantSlug);

		return this.uow.runSystemOperation("tenant.access_request.create", actor, async (scope): Promise<TenantAccessRequestResponse> => {
			const preconditions = {
				isMember: await scope.memberships.existsLive(tenantId, user.userId),
				hasPendingRequest: await scope.accessRequests.hasPending(tenantId, user.userId),
			};
			const request = AccessRequest.open(scope.accessRequests.nextId(), tenantId, user.userId, input.message ?? null, preconditions);
			const stored = await scope.accessRequests.add(request);
			await scope.audit.record({
				tenantId,
				actorUserId: user.userId,
				action: "membership.access_request_created",
				resourceType: "TenantAccessRequest",
				resourceId: stored.id,
			});
			scope.events.collectFrom(request);
			return toAccessRequestResponse(stored);
		});
	}
}
