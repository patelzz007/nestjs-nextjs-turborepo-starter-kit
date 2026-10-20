import type { ActorContext } from "../../application/actor-context";
import { anonymousRlsContext, apiKeyRlsContext, systemRlsContext, userRlsContext, type RlsContext } from "../../../prisma/rls-context";

/**
 * What one unit-of-work transaction must stamp on the Postgres session.
 * `reason` is the system-operation audit line. It is null for tenant, API-key, and anonymous scopes,
 * which do not bypass RLS and do not write that audit line.
 */
export interface RlsTransactionScope {
	readonly context: RlsContext;
	readonly reason: string | null;
}

/**
 * Maps an actor onto the RLS context factories, field for field the scope
 * `RlsInterceptor` opens for the same request (`rlsContextForPrincipal`):
 * the API key, the user's access scope, a refresh-token subject, or nobody.
 * `TenantDatabaseContext` (purpose, policy version) is the encryption session and is not used here.
 */
/** Whether a unit of work's data needs the actor's tenant (tenant rows), or is the user's own rows only. */
export interface RlsScopeOptions {
	/**
	 * `true` (tenant data): a tenant user with no tenant is refused before any connection is used.
	 * `false` (the user's own rows, scoped by `app.current_user_id`): no tenant is needed; tenant
	 * tables still deny without one, so this only drops the early refusal.
	 */
	readonly tenantRequired: boolean;
}

export const TENANT_DATA_SCOPE: RlsScopeOptions = { tenantRequired: true };
export const USER_OWNED_DATA_SCOPE: RlsScopeOptions = { tenantRequired: false };

export function toRlsTransactionScope(actor: ActorContext, options: RlsScopeOptions = TENANT_DATA_SCOPE): RlsTransactionScope {
	if (actor.kind === "system") {
		return { context: systemRlsContext(actor.operation, actor.actorUserId, actor.tenantId), reason: actor.reason };
	}
	switch (actor.kind) {
		case "api_key":
			return { context: apiKeyRlsContext(actor.apiKeyId, actor.tenantId, actor.locationId), reason: null };
		case "anonymous":
			return { context: anonymousRlsContext(actor.tenantId), reason: null };
		case "token_subject":
			return { context: userRlsContext(actor.userId, actor.tenantId, false), reason: null };
		case "user":
			return { context: userRlsContext(actor.userId, actor.tenantId, options.tenantRequired), reason: null };
	}
}

/** RLS context half of {@link toRlsTransactionScope}. */
export function toRlsContext(actor: ActorContext, options: RlsScopeOptions = TENANT_DATA_SCOPE): RlsContext {
	return toRlsTransactionScope(actor, options).context;
}
