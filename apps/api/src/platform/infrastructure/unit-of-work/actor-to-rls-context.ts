import { actingUserId, type ActorContext } from "../../application/actor-context";
import type { SystemOperationName } from "../../application/system-operation-names";
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

const SUPERADMIN_OPERATION: SystemOperationName = "platform.superadmin";
const STAFF_SINGLE_TENANT_OPERATION: SystemOperationName = "platform.staff_single_tenant";
const ROUTE_BYPASS_OPERATION: SystemOperationName = "route.rls_bypass";

/**
 * Maps an actor onto the RLS context factories, field for field the scope
 * `RlsInterceptor` opens for the same request (`rlsContextForPrincipal`):
 * a `@RlsBypass()` route first, then the API key, the user's access scope, a
 * refresh-token subject, or nobody. `TenantDatabaseContext` (purpose, policy
 * version) is the encryption session and is not used here.
 */
/** Whether a unit of work's data needs the actor's organization (tenant rows), or is the user's own rows only. */
export interface RlsScopeOptions {
	/**
	 * `true` (tenant data): a tenant user with no organization is refused before any connection is used.
	 * `false` (the user's own rows, scoped by `app.current_user_id`): no organization is needed; tenant
	 * tables still deny without one, so this only drops the early refusal.
	 */
	readonly organizationRequired: boolean;
}

export const TENANT_DATA_SCOPE: RlsScopeOptions = { organizationRequired: true };
export const USER_OWNED_DATA_SCOPE: RlsScopeOptions = { organizationRequired: false };

export function toRlsTransactionScope(actor: ActorContext, options: RlsScopeOptions = TENANT_DATA_SCOPE): RlsTransactionScope {
	if (actor.kind === "system") {
		return { context: systemRlsContext(actor.operation, actor.actorUserId, actor.organizationId), reason: actor.reason };
	}
	if (actor.routeRlsBypass === true) {
		return { context: systemRlsContext(ROUTE_BYPASS_OPERATION, actingUserId(actor), actor.organizationId), reason: ROUTE_BYPASS_OPERATION };
	}
	switch (actor.kind) {
		case "api_key":
			return { context: apiKeyRlsContext(actor.apiKeyId, actor.organizationId, actor.locationId), reason: null };
		case "anonymous":
			return { context: anonymousRlsContext(actor.organizationId), reason: null };
		case "token_subject":
			return { context: userRlsContext(actor.userId, actor.organizationId, false), reason: null };
		case "user":
			return userScope(actor.userId, actor.organizationId, actor.accessScope, options);
	}
}

function userScope(
	userId: string,
	organizationId: string | null,
	accessScope: "tenant" | "superadmin" | "staff_single_tenant",
	options: RlsScopeOptions,
): RlsTransactionScope {
	switch (accessScope) {
		case "superadmin":
			return { context: systemRlsContext(SUPERADMIN_OPERATION, userId, organizationId), reason: SUPERADMIN_OPERATION };
		case "staff_single_tenant":
			return { context: systemRlsContext(STAFF_SINGLE_TENANT_OPERATION, userId, organizationId), reason: STAFF_SINGLE_TENANT_OPERATION };
		case "tenant":
			return { context: userRlsContext(userId, organizationId, options.organizationRequired), reason: null };
	}
}

/** RLS context half of {@link toRlsTransactionScope}. */
export function toRlsContext(actor: ActorContext, options: RlsScopeOptions = TENANT_DATA_SCOPE): RlsContext {
	return toRlsTransactionScope(actor, options).context;
}
