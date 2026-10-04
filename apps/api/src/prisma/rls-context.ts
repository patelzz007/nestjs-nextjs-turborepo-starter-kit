import { AsyncLocalStorage } from "node:async_hooks";

import { MissingTenantContextError } from "./missing-tenant-context.error";
import { DEFAULT_DATABASE_ROLE, parseSystemOperation, systemOperationDefinition, type DatabaseRole, type SystemOperation } from "./system-operation.registry";

/** Fields every RLS scope carries; the variants below pin them per kind. */
interface RlsContextBase {
	/** PostgreSQL role the checkout switches to (`SET ROLE`) — the operation's role, or `app_runtime`. */
	readonly role: DatabaseRole;
	/** Server-verified organization the scope is bound to; `null` = none bound (never a placeholder id). */
	readonly organizationId: string | null;
}

/** An authenticated user (or a refresh-token subject): no bypass. */
export interface UserRlsContext extends RlsContextBase {
	readonly kind: "user";
	readonly userId: string;
	readonly bypass: false;
	/** Tenant-scoped pool access without a bound organization fails closed (see `rls-pool.ts`). */
	readonly requireExplicitContext: boolean;
	readonly systemOperation: null;
}

/** An allowlisted system operation: bypass, named, with the acting user when there is one. */
export interface SystemRlsContext extends RlsContextBase {
	readonly kind: "system";
	/** The user the operation runs on behalf of; `null` for background work with no human actor. */
	readonly userId: string | null;
	readonly bypass: true;
	readonly requireExplicitContext: false;
	readonly systemOperation: SystemOperation;
}

/**
 * A merchant API key (POS till or integration), verified by the API-key guards. A machine principal:
 * no user, no bypass. The policies in prisma/rls/40-api-key-principal.sql let it reach only its own
 * organization's rows — and, for a store-scoped key, only its store's rows where a row has a store.
 */
export interface ApiKeyRlsContext extends RlsContextBase {
	readonly kind: "api_key";
	readonly organizationId: string;
	readonly apiKeyId: string;
	/** The store the key is limited to; `null` for an organization-wide key. */
	readonly apiKeyLocationId: string | null;
	readonly userId: null;
	readonly bypass: false;
	readonly requireExplicitContext: false;
	readonly systemOperation: null;
}

/** No principal: no user, no bypass — only rows RLS exposes publicly. */
export interface AnonymousRlsContext extends RlsContextBase {
	readonly kind: "anonymous";
	readonly userId: null;
	readonly bypass: false;
	readonly requireExplicitContext: false;
	readonly systemOperation: null;
}

/**
 * Per-request / per-job RLS context for the pool checkout path — a
 * discriminated union, so "no user" and "no organization" are `null`, never
 * an empty-string sentinel. Authoritative isolation is enforced inside
 * `TenantTransactionService` transactions.
 */
export type RlsContext = UserRlsContext | SystemRlsContext | ApiKeyRlsContext | AnonymousRlsContext;

export const rlsStorage: AsyncLocalStorage<RlsContext> = new AsyncLocalStorage<RlsContext>();

/** Context used when no scope was opened — sees only rows visible without a user. */
const UNSCOPED_CONTEXT: AnonymousRlsContext = anonymousRlsContext(null);

/** A non-bypass context for an authenticated user — the default role, no system operation. */
export function userRlsContext(userId: string, organizationId: string | null, requireExplicitContext: boolean): UserRlsContext {
	return { kind: "user", userId, bypass: false, organizationId, requireExplicitContext, systemOperation: null, role: DEFAULT_DATABASE_ROLE };
}

/** A verified merchant API key acting for its organization (and store, when store-scoped). */
export function apiKeyRlsContext(apiKeyId: string, organizationId: string, apiKeyLocationId: string | null): ApiKeyRlsContext {
	return {
		kind: "api_key",
		apiKeyId,
		organizationId,
		apiKeyLocationId,
		userId: null,
		bypass: false,
		requireExplicitContext: false,
		systemOperation: null,
		role: DEFAULT_DATABASE_ROLE,
	};
}

/** A context with no principal at all. */
export function anonymousRlsContext(organizationId: string | null): AnonymousRlsContext {
	return { kind: "anonymous", userId: null, bypass: false, organizationId, requireExplicitContext: false, systemOperation: null, role: DEFAULT_DATABASE_ROLE };
}

/** Fail closed — callers must use tenant transactions or allowlisted system operations. */
export function currentRlsContext(): RlsContext {
	const store = rlsStorage.getStore();
	if (store === undefined) {
		throw new MissingTenantContextError();
	}
	return store;
}

/**
 * Pool checkout context. Without an open scope the connection is **not**
 * bypassed: it runs as an anonymous, non-bypass session so a query issued
 * outside any request/job scope can only see rows RLS exposes publicly.
 */
export function currentRlsContextOrUnscoped(): RlsContext {
	return rlsStorage.getStore() ?? UNSCOPED_CONTEXT;
}

/**
 * Build the bypass context for an allowlisted system operation. The name is
 * re-validated at runtime (callers can reach this with a configured string),
 * and the context carries the operation's role so the pool enforces it.
 */
export function systemRlsContext(operation: SystemOperation, actorUserId: string | null = null, organizationId: string | null = null): SystemRlsContext {
	const allowlisted: SystemOperation = parseSystemOperation(operation);
	return {
		kind: "system",
		userId: actorUserId,
		bypass: true,
		organizationId,
		requireExplicitContext: false,
		systemOperation: allowlisted,
		role: systemOperationDefinition(allowlisted).role,
	};
}

/**
 * The session variables the RLS policies read (prisma/rls.sql:
 * `app.current_user_id`, `app.current_organization_id`, …). SQL has no
 * "absent" for a GUC, so a missing user / organization is encoded as `''`
 * here — a database-encoding detail, not a domain value.
 */
export interface RlsSessionVariables {
	readonly role: DatabaseRole;
	readonly currentUserId: string;
	readonly currentOrganizationId: string;
	readonly rlsBypass: "true" | "false";
	readonly systemOperation: string;
	readonly currentApiKeyId: string;
	readonly currentApiKeyLocationId: string;
}

const UNSET_SESSION_VARIABLE = "";

export function rlsSessionVariables(context: RlsContext): RlsSessionVariables {
	return {
		role: context.role,
		currentUserId: context.userId ?? UNSET_SESSION_VARIABLE,
		currentOrganizationId: context.organizationId ?? UNSET_SESSION_VARIABLE,
		rlsBypass: context.bypass ? "true" : "false",
		systemOperation: context.systemOperation ?? UNSET_SESSION_VARIABLE,
		currentApiKeyId: context.kind === "api_key" ? context.apiKeyId : UNSET_SESSION_VARIABLE,
		currentApiKeyLocationId: context.kind === "api_key" ? (context.apiKeyLocationId ?? UNSET_SESSION_VARIABLE) : UNSET_SESSION_VARIABLE,
	};
}

/**
 * Run background work (queue jobs, cron maintenance) under an explicit,
 * allowlisted system operation. This is the only way non-request code
 * obtains an RLS bypass on the shared pool.
 */
export function runWithSystemRlsContext<T>(operation: SystemOperation, handler: () => T): T {
	return rlsStorage.run(systemRlsContext(operation), handler);
}
