import { applyDecorators, Inject, Injectable, SetMetadata, UseGuards, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureFlagKeySchema, type FeatureFlagKey } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ActorContextFactory } from "../../../../platform/presentation/http/security/actor-context.factory";
import { FEATURE_FLAGS, type FeatureFlags, type FlagCheckSubject } from "../../application/ports/feature-flags.port";
import { FeatureUnavailableError } from "../../domain/errors/feature-flag.errors";

/** Metadata key: the flag a route requires. */
export const REQUIRED_FEATURE_FLAG_KEY = "requiredFeatureFlag";

/** Who a guarded request is for: the person, and the tenant (and an API key's location) the request resolved to. */
function subjectOf(actor: ActorContext): FlagCheckSubject {
	switch (actor.kind) {
		case "user":
			return { userId: actor.userId, tenantId: actor.tenantId, locationId: null };
		case "api_key":
			return { userId: null, tenantId: actor.tenantId, locationId: actor.locationId };
		case "anonymous":
			return { userId: null, tenantId: actor.tenantId, locationId: null };
		case "token_subject":
			return { userId: actor.userId, tenantId: actor.tenantId, locationId: null };
		case "system":
			return { userId: actor.actorUserId, tenantId: actor.tenantId, locationId: null };
	}
}

/**
 * Refuses a request while the route's feature flag is off for its caller: 403 `FEATURE_UNAVAILABLE` (ADR 087). The
 * caller is resolved the same way as for `@CurrentActor()`; an API key's store counts as its tenant and location.
 * Runs after the global authentication and authorization guards, so a refused caller learns only that it's off.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
	public constructor(
		private readonly reflector: Reflector,
		@Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
		@Inject(ActorContextFactory) private readonly actors: Pick<ActorContextFactory, "fromHttpRequest">,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const key = FeatureFlagKeySchema.safeParse(
			this.reflector.get(REQUIRED_FEATURE_FLAG_KEY, context.getHandler()) ?? this.reflector.get(REQUIRED_FEATURE_FLAG_KEY, context.getClass()),
		);
		if (!key.success) {
			return true;
		}
		const subject = subjectOf(this.actors.fromHttpRequest(context.switchToHttp().getRequest<FastifyRequest>(), { allowAnonymous: true }));
		if (!(await this.flags.isOn(key.data, subject))) {
			throw new FeatureUnavailableError(key.data);
		}
		return true;
	}
}

/** The route (or every route of a controller) works only while `key` is on for its caller. */
export function RequireFeatureFlag(key: FeatureFlagKey): ReturnType<typeof applyDecorators> {
	return applyDecorators(SetMetadata(REQUIRED_FEATURE_FLAG_KEY, key), UseGuards(FeatureFlagGuard));
}
