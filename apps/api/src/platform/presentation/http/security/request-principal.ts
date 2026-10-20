import { AccessTokenPayloadSchema, type AccessTokenPayload } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ActorContextSchema, RequestMetadataSchema, type ActorContext, type RequestMetadata } from "../../../application/actor-context";
import { auditDeviceFields, UNMATCHED_ENDPOINT } from "../../../infrastructure/audit/http-audit-entry";
import type { RequestActorResolution, RequestApiKeyPrincipal, RequestContext } from "../../../infrastructure/context/request-context";
import { anonymousRlsContext, apiKeyRlsContext, userRlsContext, type RlsContext } from "../../../../prisma/rls-context";
import { isAuthenticatedUser, type AuthenticatedUser } from "../../../../types/authenticated-user";

/** How an authenticated user is scoped in Postgres. */
export type UserAccessScope = "tenant";

/** Who is calling, as the guards verified it. */
export type RequestPrincipal =
	| { readonly kind: "api_key"; readonly apiKey: RequestApiKeyPrincipal }
	| { readonly kind: "user"; readonly user: AuthenticatedUser; readonly accessScope: UserAccessScope }
	/** A verified refresh token's subject (refresh / logout): no access token, no session, no role. */
	| { readonly kind: "token_subject"; readonly userId: string }
	| { readonly kind: "anonymous" };

/**
 * THE per-request access decision. `RlsInterceptor` scopes the database from it
 * ({@link rlsContextForPrincipal}) and `@CurrentActor()` hands handlers the actor
 * built from it ({@link actorForPrincipal}), so the two can never disagree.
 */
export interface RequestPrincipalDecision {
	readonly principal: RequestPrincipal;
	/** The server-verified tenant ({@link boundTenantId}); never a client-supplied id. */
	readonly tenantId: string | null;
}

/** The verified facts a decision is made from. */
export interface RequestPrincipalFacts {
	readonly user: FastifyRequest["user"];
	readonly apiKey: RequestApiKeyPrincipal | undefined;
	readonly requestTenantId: string | undefined;
}

/**
 * The guard-verified request tenant, in both modes: `AuthorizationGuard` binds it only after the
 * tenant source resolved the route's `:tenantSlug` (in single mode, only the boot-verified default
 * tenant can be named) and the caller's membership or support grant was verified. With none bound
 * the scope has no tenant (`null`); it never falls back to a default tenant.
 */
export function boundTenantId(requestTenantId: string | undefined): string | null {
	return requestTenantId ?? null;
}

/** A verified API key first, then the access token's user, then a refresh-token subject, then nobody. */
export function resolveRequestPrincipal(facts: RequestPrincipalFacts): RequestPrincipalDecision {
	return { principal: principalOf(facts), tenantId: boundTenantId(facts.requestTenantId) };
}

function principalOf(facts: RequestPrincipalFacts): RequestPrincipal {
	if (facts.apiKey !== undefined) {
		return { kind: "api_key", apiKey: facts.apiKey };
	}
	if (facts.user === undefined) {
		return { kind: "anonymous" };
	}
	if (isAuthenticatedUser(facts.user)) {
		return { kind: "user", user: facts.user, accessScope: userAccessScope() };
	}
	return { kind: "token_subject", userId: facts.user.sub };
}

/** A superadmin is not a database superuser. Platform routes name their own operation. */
function userAccessScope(): UserAccessScope {
	return "tenant";
}

/** The tenant a scope is bound to: an API key's own; otherwise the verified request tenant. */
/** The person behind a request, recorded on a route operation's audit line: a user or a refresh-token subject; null for a key or anonymous. */
export function principalUserId(decision: RequestPrincipalDecision): string | null {
	const { principal } = decision;
	if (principal.kind === "user") {
		return principal.user.sub;
	}
	return principal.kind === "token_subject" ? principal.userId : null;
}

/** The tenant a request's database scope belongs to: an API key's own tenant, otherwise the verified request tenant. */
export function scopeTenantId(decision: RequestPrincipalDecision): string | null {
	return decision.principal.kind === "api_key" ? decision.principal.apiKey.tenantId : decision.tenantId;
}

/** The RLS scope of the request — the same scope `toRlsTransactionScope` derives from {@link actorForPrincipal}'s actor. */
export function rlsContextForPrincipal(decision: RequestPrincipalDecision): RlsContext {
	const { principal } = decision;
	const tenantId: string | null = scopeTenantId(decision);
	switch (principal.kind) {
		case "api_key":
			return apiKeyRlsContext(principal.apiKey.apiKeyId, principal.apiKey.tenantId, principal.apiKey.locationId);
		case "anonymous":
			return anonymousRlsContext(tenantId);
		case "token_subject":
			return userRlsContext(principal.userId, tenantId, false);
		case "user":
			// The request scope never requires a tenant: a customer has none, and RLS without one
			// already denies every tenant row. Tenant units of work still refuse early (`withRlsContext`).
			return userRlsContext(principal.user.sub, tenantId, false);
	}
}

/** The actor `@CurrentActor()` hands the handler. Never throws: a missing session id is recorded, raised only if asked for. */
export function actorForPrincipal(decision: RequestPrincipalDecision, request: RequestMetadata): RequestActorResolution {
	const { principal } = decision;
	const tenantId: string | null = scopeTenantId(decision);
	switch (principal.kind) {
		case "api_key":
			return {
				status: "resolved",
				actor: ActorContextSchema.parse({
					kind: "api_key",
					apiKeyId: principal.apiKey.apiKeyId,
					tenantId: principal.apiKey.tenantId,
					locationId: principal.apiKey.locationId,
					terminalId: principal.apiKey.terminalId ?? null,
					request,
				}),
			};
		case "anonymous":
			return { status: "anonymous", actor: ActorContextSchema.parse({ kind: "anonymous", tenantId, request }) };
		case "token_subject":
			return { status: "resolved", actor: ActorContextSchema.parse({ kind: "token_subject", userId: principal.userId, tenantId, request }) };
		case "user":
			return userActor(principal.user, principal.accessScope, tenantId, request);
	}
}

function userActor(user: AuthenticatedUser, accessScope: UserAccessScope, tenantId: string | null, request: RequestMetadata): RequestActorResolution {
	const payload: AccessTokenPayload = AccessTokenPayloadSchema.parse(user);
	const sessionId: string | null = sessionIdOf(payload);
	if (sessionId === null) {
		return { status: "unresolvable", reason: "Session id is required to build an actor context." };
	}
	const actor: ActorContext = ActorContextSchema.parse({
		kind: "user",
		userId: payload.sub,
		sessionId,
		tenantId,
		isSuperAdmin: payload.isSuperAdmin,
		accessScope,
		impersonatorUserId: payload.isImpersonating === true ? (payload.originalUserId ?? null) : null,
		request,
	});
	return { status: "resolved", actor };
}

function sessionIdOf(payload: AccessTokenPayload): string | null {
	if (payload.sid !== undefined) {
		return payload.sid;
	}
	if (payload.isImpersonating === true && payload.impersonationSessionId !== undefined) {
		return payload.impersonationSessionId;
	}
	return null;
}

/** Audit-facing request facts carried on every HTTP actor. */
export function buildRequestMetadata(request: FastifyRequest, context: RequestContext): RequestMetadata {
	const endpoint: string = request.routeOptions.url ?? UNMATCHED_ENDPOINT;
	const metadata: RequestMetadata = RequestMetadataSchema.parse({
		requestId: context.correlationId,
		ip: context.ip ?? null,
		userAgent: context.userAgent ?? null,
		deviceLabel: deviceLabelFromUserAgent(context.userAgent),
		endpoint,
	});
	return metadata;
}

function deviceLabelFromUserAgent(userAgent: string | undefined): string | null {
	if (userAgent === undefined) {
		return null;
	}
	const parsed = auditDeviceFields(userAgent);
	const browser: string | null = parsed.browserName;
	const os: string | null = parsed.osName;
	if (browser === null && os === null) {
		return null;
	}
	if (browser !== null && os !== null) {
		return `${browser} on ${os}`;
	}
	return browser ?? os;
}
