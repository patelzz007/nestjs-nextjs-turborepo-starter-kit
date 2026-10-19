import { AccessTokenPayloadSchema, type AccessTokenPayload } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { ActorContextSchema, RequestMetadataSchema, type ActorContext, type RequestMetadata } from "../../../application/actor-context";
import type { SystemOperationName } from "../../../application/system-operation-names";
import { auditDeviceFields, UNMATCHED_ENDPOINT } from "../../../infrastructure/audit/http-audit-entry";
import type { RequestActorResolution, RequestApiKeyPrincipal, RequestContext } from "../../../infrastructure/context/request-context";
import { anonymousRlsContext, apiKeyRlsContext, systemRlsContext, userRlsContext, type RlsContext } from "../../../../prisma/rls-context";
import { isAuthenticatedUser, type AuthenticatedUser } from "../../../../types/authenticated-user";
import type { ActorTenancyPolicy } from "./actor-tenancy.policy";

/** How an authenticated user is scoped in Postgres. */
export type UserAccessScope = "tenant" | "superadmin" | "staff_single_tenant";

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
	/** The route is `@RlsBypass()`: whoever calls, it runs under `route.rls_bypass`. */
	readonly routeRlsBypass: boolean;
	/** The server-verified organization ({@link boundOrganizationId}); never a client-supplied id. */
	readonly organizationId: string | null;
}

/** The verified facts a decision is made from. */
export interface RequestPrincipalFacts {
	readonly routeRlsBypass: boolean;
	readonly user: FastifyRequest["user"];
	readonly apiKey: RequestApiKeyPrincipal | undefined;
	readonly requestOrganizationId: string | undefined;
}

const ROUTE_BYPASS_OPERATION: SystemOperationName = "route.rls_bypass";
const SUPERADMIN_OPERATION: SystemOperationName = "platform.superadmin";
const STAFF_SINGLE_TENANT_OPERATION: SystemOperationName = "platform.staff_single_tenant";

/**
 * Single-tenant mode: the boot-verified default organization. Multi-tenant mode:
 * only the guard-verified request tenant — with none bound the scope has no
 * organization (`null`); it never falls back to a default organization.
 */
export function boundOrganizationId(tenancy: ActorTenancyPolicy, requestOrganizationId: string | undefined): string | null {
	if (!tenancy.enabled) {
		return tenancy.singleTenantOrganizationId();
	}
	return requestOrganizationId ?? null;
}

/** A verified API key first, then the access token's user, then a refresh-token subject, then nobody. */
export function resolveRequestPrincipal(facts: RequestPrincipalFacts, tenancy: ActorTenancyPolicy): RequestPrincipalDecision {
	return { principal: principalOf(facts, tenancy), routeRlsBypass: facts.routeRlsBypass, organizationId: boundOrganizationId(tenancy, facts.requestOrganizationId) };
}

function principalOf(facts: RequestPrincipalFacts, tenancy: ActorTenancyPolicy): RequestPrincipal {
	if (facts.apiKey !== undefined) {
		return { kind: "api_key", apiKey: facts.apiKey };
	}
	if (facts.user === undefined) {
		return { kind: "anonymous" };
	}
	if (isAuthenticatedUser(facts.user)) {
		return { kind: "user", user: facts.user, accessScope: userAccessScope(facts.user, tenancy) };
	}
	return { kind: "token_subject", userId: facts.user.sub };
}

function userAccessScope(user: AuthenticatedUser, tenancy: ActorTenancyPolicy): UserAccessScope {
	if (user.isSuperAdmin) {
		return "superadmin";
	}
	if (tenancy.staffBypassesRls && user.hasAdminAccess) {
		return "staff_single_tenant";
	}
	return "tenant";
}

/** The organization a scope is bound to: an API key's own; otherwise the verified request organization. */
function scopeOrganizationId(decision: RequestPrincipalDecision): string | null {
	return decision.principal.kind === "api_key" ? decision.principal.apiKey.organizationId : decision.organizationId;
}

function principalUserId(principal: RequestPrincipal): string | null {
	switch (principal.kind) {
		case "user":
			return principal.user.sub;
		case "token_subject":
			return principal.userId;
		case "api_key":
		case "anonymous":
			return null;
	}
}

/** The RLS scope of the request — the same scope `toRlsTransactionScope` derives from {@link actorForPrincipal}'s actor. */
export function rlsContextForPrincipal(decision: RequestPrincipalDecision): RlsContext {
	const { principal } = decision;
	const organizationId: string | null = scopeOrganizationId(decision);
	if (decision.routeRlsBypass) {
		return systemRlsContext(ROUTE_BYPASS_OPERATION, principalUserId(principal), organizationId);
	}
	switch (principal.kind) {
		case "api_key":
			return apiKeyRlsContext(principal.apiKey.apiKeyId, principal.apiKey.organizationId, principal.apiKey.locationId);
		case "anonymous":
			return anonymousRlsContext(organizationId);
		case "token_subject":
			return userRlsContext(principal.userId, organizationId, false);
		case "user":
			return userRlsContextFor(principal.user.sub, organizationId, principal.accessScope);
	}
}

function userRlsContextFor(userId: string, organizationId: string | null, accessScope: UserAccessScope): RlsContext {
	switch (accessScope) {
		case "superadmin":
			return systemRlsContext(SUPERADMIN_OPERATION, userId, organizationId);
		case "staff_single_tenant":
			return systemRlsContext(STAFF_SINGLE_TENANT_OPERATION, userId, organizationId);
		case "tenant":
			// The request scope never requires an organization: a customer has none, and RLS without one
			// already denies every tenant row. Tenant units of work still refuse early (`withRlsContext`).
			return userRlsContext(userId, organizationId, false);
	}
}

/** The actor `@CurrentActor()` hands the handler. Never throws: a missing session id is recorded, raised only if asked for. */
export function actorForPrincipal(decision: RequestPrincipalDecision, request: RequestMetadata): RequestActorResolution {
	const { principal, routeRlsBypass } = decision;
	const organizationId: string | null = scopeOrganizationId(decision);
	switch (principal.kind) {
		case "api_key":
			return {
				status: "resolved",
				actor: ActorContextSchema.parse({
					kind: "api_key",
					apiKeyId: principal.apiKey.apiKeyId,
					organizationId: principal.apiKey.organizationId,
					locationId: principal.apiKey.locationId,
					terminalId: principal.apiKey.terminalId ?? null,
					request,
					routeRlsBypass,
				}),
			};
		case "anonymous":
			return { status: "anonymous", actor: ActorContextSchema.parse({ kind: "anonymous", organizationId, request, routeRlsBypass }) };
		case "token_subject":
			return { status: "resolved", actor: ActorContextSchema.parse({ kind: "token_subject", userId: principal.userId, organizationId, request, routeRlsBypass }) };
		case "user":
			return userActor(principal.user, principal.accessScope, organizationId, request, routeRlsBypass);
	}
}

function userActor(
	user: AuthenticatedUser,
	accessScope: UserAccessScope,
	organizationId: string | null,
	request: RequestMetadata,
	routeRlsBypass: boolean,
): RequestActorResolution {
	const payload: AccessTokenPayload = AccessTokenPayloadSchema.parse(user);
	const sessionId: string | null = sessionIdOf(payload);
	if (sessionId === null) {
		return { status: "unresolvable", reason: "Session id is required to build an actor context." };
	}
	const actor: ActorContext = ActorContextSchema.parse({
		kind: "user",
		userId: payload.sub,
		sessionId,
		organizationId,
		isSuperAdmin: payload.isSuperAdmin,
		accessScope,
		impersonatorUserId: payload.isImpersonating === true ? (payload.originalUserId ?? null) : null,
		request,
		routeRlsBypass,
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
