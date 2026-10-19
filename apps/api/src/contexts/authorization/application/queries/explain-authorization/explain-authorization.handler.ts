import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AuthorizationResult } from "@workspace/shared";

import { requireUserActor } from "../../services/rbac-actor";
import { AUTHORIZATION_KERNEL } from "../../ports/authorization.tokens";
import type { AuthorizationKernelPort } from "../../ports/authorization-kernel.port";
import { ExplainAuthorizationQuery } from "./explain-authorization.query";

/**
 * The SuperAdmin bypass only applies when explaining oneself; another user is always explained as a
 * regular subject. The kernel re-verifies organization / location membership for the explained subject.
 */
@QueryHandler(ExplainAuthorizationQuery)
export class ExplainAuthorizationHandler implements IQueryHandler<ExplainAuthorizationQuery, AuthorizationResult> {
	public constructor(@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort) {}

	public async execute(query: ExplainAuthorizationQuery): Promise<AuthorizationResult> {
		const actor = requireUserActor(query.actor);
		const explain = query.explain;
		const explainingSelf: boolean = explain.userId === undefined || explain.userId === actor.userId;
		return this.kernel.explain({
			subject: {
				userId: explain.userId ?? actor.userId,
				isSuperAdmin: explainingSelf ? actor.isSuperAdmin : false,
				...(explain.organizationId === undefined ? {} : { organizationId: explain.organizationId }),
				...(explain.storeId === undefined ? {} : { storeId: explain.storeId }),
				...(explain.locationId === undefined ? {} : { locationId: explain.locationId }),
			},
			action: explain.action,
			resource: explain.resource,
			...(explain.resourceId === undefined ? {} : { resourceId: explain.resourceId }),
		});
	}
}
