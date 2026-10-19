import { z } from "zod";

import { SystemOperationNameSchema, type SystemOperationName } from "./system-operation-names";

/** Request metadata copied into audit entries; null when not applicable (jobs, CLI). */
export const RequestMetadataSchema = z.object({
	requestId: z.string().min(1),
	ip: z.string().nullable(),
	userAgent: z.string().nullable(),
	deviceLabel: z.string().nullable(),
	endpoint: z.string().nullable(),
});

/**
 * True on an `@RlsBypass()` route: the request runs under the `route.rls_bypass`
 * system operation, whoever the caller is — the same decision `RlsInterceptor`
 * makes, from the same resolver (`request-principal.ts`). Absent means false: an
 * actor built outside an HTTP request (a test fixture, a guard) never bypasses.
 */
const RouteRlsBypassSchema = z.boolean().optional();

/** Where a system actor's work was triggered from. */
export const SystemOriginSchema = z.enum(["job", "cron", "cli", "bootstrap", "consumer"]);

export const ActorContextSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("user"),
		userId: z.string().min(1),
		sessionId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		isSuperAdmin: z.boolean(),
		/**
		 * How this user is scoped in Postgres. Decided once, from the same rules as `RlsInterceptor`:
		 * superadmin, single-tenant staff, or a normal tenant user.
		 */
		accessScope: z.enum(["tenant", "superadmin", "staff_single_tenant"]),
		impersonatorUserId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
		routeRlsBypass: RouteRlsBypassSchema,
	}),
	z.object({
		kind: z.literal("api_key"),
		apiKeyId: z.string().min(1),
		organizationId: z.string().min(1),
		locationId: z.string().min(1).nullable(),
		terminalId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
		routeRlsBypass: RouteRlsBypassSchema,
	}),
	z.object({
		kind: z.literal("system"),
		operation: SystemOperationNameSchema,
		origin: SystemOriginSchema,
		organizationId: z.string().min(1).nullable(),
		/** Human on whose behalf the operation runs; null for background work with no user. */
		actorUserId: z.string().min(1).nullable(),
		/** Audit line for the system-operation transaction (`SystemDatabaseContext.reason`). */
		reason: z.string().min(1),
	}),
	z.object({
		kind: z.literal("anonymous"),
		/** Server-resolved tenant, or null when the request has no organization. Never a client-supplied id. */
		organizationId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
		routeRlsBypass: RouteRlsBypassSchema,
	}),
	z.object({
		/**
		 * The subject of a verified refresh token (refresh and logout routes): a user
		 * whose access token is not on the request, so no session, role or scope is known.
		 * Scoped to that user without requiring an organization, like `RlsInterceptor`.
		 */
		kind: z.literal("token_subject"),
		userId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
		routeRlsBypass: RouteRlsBypassSchema,
	}),
]);

export type ActorContext = z.output<typeof ActorContextSchema>;
export type RequestMetadata = z.output<typeof RequestMetadataSchema>;
export type SystemOrigin = z.output<typeof SystemOriginSchema>;

/** The user an actor acts as or on behalf of, or null (an API key, an anonymous caller, background work). */
export function actingUserId(actor: ActorContext): string | null {
	switch (actor.kind) {
		case "user":
		case "token_subject":
			return actor.userId;
		case "system":
			return actor.actorUserId;
		case "api_key":
		case "anonymous":
			return null;
	}
}

/**
 * The actor bound to the organization its access was just verified for, so a unit of work's RLS session
 * is that tenant's (as the tenant transaction of the same request always was). Only a signed-in user is
 * re-bound; every other actor (an API key is bound to its own organization) is returned unchanged.
 */
export function actingInOrganization<TActor extends ActorContext>(actor: TActor, organizationId: string): TActor {
	return actor.kind === "user" ? { ...actor, organizationId } : actor;
}

/** Builds a validated system actor for jobs, cron, CLI, bootstrap, and consumers. */
export function systemActor(operation: SystemOperationName, origin: SystemOrigin, organizationId: string | null, reason: string, actorUserId: string | null): ActorContext {
	const parsed: ActorContext = ActorContextSchema.parse({
		kind: "system",
		operation: SystemOperationNameSchema.parse(operation),
		origin: SystemOriginSchema.parse(origin),
		organizationId,
		actorUserId,
		reason,
	});
	return parsed;
}
