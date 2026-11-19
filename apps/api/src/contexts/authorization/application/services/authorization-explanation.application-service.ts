import { Inject, Injectable } from "@nestjs/common";
import type { AuthorizationExplainQuery, AuthorizationResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AUTHORIZATION_KERNEL } from "../ports/authorization.tokens";
import type { AuthorizationKernelPort } from "../ports/authorization-kernel.port";
import { requireUserActor } from "./rbac-actor";

/** Why the kernel would allow or deny a request (ADR 096). */
@Injectable()
export class AuthorizationExplanationApplicationService {
	public constructor(@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort) {}

	/**
	 * The SuperAdmin bypass only applies when explaining oneself; another user is always explained as a
	 * regular subject. The kernel re-verifies tenant / location membership for the explained subject.
	 */
	public async explain(actor: ActorContext, explain: AuthorizationExplainQuery): Promise<AuthorizationResult> {
		const user = requireUserActor(actor);
		const explainingSelf: boolean = explain.userId === undefined || explain.userId === user.userId;
		return this.kernel.explain({
			subject: {
				userId: explain.userId ?? user.userId,
				isSuperAdmin: explainingSelf ? user.isSuperAdmin : false,
				...(explain.tenantId === undefined ? {} : { tenantId: explain.tenantId }),
				...(explain.locationId === undefined ? {} : { locationId: explain.locationId }),
			},
			action: explain.action,
			resource: explain.resource,
			...(explain.resourceId === undefined ? {} : { resourceId: explain.resourceId }),
		});
	}
}
