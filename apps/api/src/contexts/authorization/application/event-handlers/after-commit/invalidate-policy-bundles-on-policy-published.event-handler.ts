import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { ThrownErrorSchema } from "@workspace/shared";

import { PolicyPublished } from "../../../domain/events/policy-published.event";
import type { AuthorizationCacheInvalidationPort } from "../../ports/authorization-cache-invalidation.port";
import { AUTHORIZATION_CACHE_INVALIDATION } from "../../ports/authorization.tokens";

/** After commit: drop the stale compiled bundles on every instance (a platform slot is in every tenant's bundle). */
@EventsHandler(PolicyPublished)
export class InvalidatePolicyBundlesOnPolicyPublished implements IEventHandler<PolicyPublished> {
	private readonly logger: Logger = new Logger(InvalidatePolicyBundlesOnPolicyPublished.name);

	public constructor(@Inject(AUTHORIZATION_CACHE_INVALIDATION) private readonly invalidation: AuthorizationCacheInvalidationPort) {}

	public async handle(event: PolicyPublished): Promise<void> {
		try {
			await this.invalidation.invalidatePolicyBundles(event.tenantId === null ? { kind: "all" } : { kind: "tenant", tenantId: event.tenantId });
		} catch (error) {
			const thrown = ThrownErrorSchema.safeParse(error);
			this.logger.error(`Policy bundle invalidation failed; bundles converge at their TTL: ${thrown.success ? thrown.data.message : "unknown error"}`);
		}
	}
}
