import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AuthorizationContext, AuthorizationDecision, AuthorizationDecisionsResponse } from "@workspace/shared";

import { requireUserActor } from "../../services/rbac-actor";
import { AUTHORIZATION_KERNEL, REQUEST_TENANT } from "../../ports/authorization.tokens";
import type { AuthorizationKernelPort } from "../../ports/authorization-kernel.port";
import type { RequestTenantPort, VerifiedRequestTenant } from "../../ports/rbac-read.port";
import { DecideAuthorizationQuery } from "./decide-authorization.query";

/** The subject is always the caller, in the tenant `AuthorizationGuard` verified, never ids from the request body. */
@QueryHandler(DecideAuthorizationQuery)
export class DecideAuthorizationHandler implements IQueryHandler<DecideAuthorizationQuery, AuthorizationDecisionsResponse> {
	public constructor(
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
		@Inject(REQUEST_TENANT) private readonly tenant: RequestTenantPort,
	) {}

	public async execute(query: DecideAuthorizationQuery): Promise<AuthorizationDecisionsResponse> {
		const actor = requireUserActor(query.actor);
		const tenant: VerifiedRequestTenant = this.tenant.current();
		const subject: AuthorizationContext = { userId: actor.userId, isSuperAdmin: actor.isSuperAdmin, ...tenant };
		const results = await Promise.all(
			query.checks.map(async (check) => {
				const decision: AuthorizationDecision = await this.kernel.can({
					subject,
					action: check.action,
					resource: check.resource,
					...(check.resourceId === undefined ? {} : { resourceId: check.resourceId }),
				});
				return { ...check, allowed: decision === "ALLOW" };
			}),
		);
		return { results };
	}
}
