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

/** Where a system actor's work was triggered from. */
export const SystemOriginSchema = z.enum(["job", "cron", "cli", "bootstrap", "consumer"]);

export const ActorContextSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("user"),
		userId: z.string().min(1),
		sessionId: z.string().min(1),
		tenantId: z.string().min(1).nullable(),
		isSuperAdmin: z.boolean(),
		/**
		 * How this user is scoped in Postgres. Identity never widens the session:
		 * a superadmin is a tenant user until a route names its own operation.
		 */
		accessScope: z.enum(["tenant"]),
		impersonatorUserId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
	z.object({
		kind: z.literal("api_key"),
		apiKeyId: z.string().min(1),
		tenantId: z.string().min(1),
		locationId: z.string().min(1).nullable(),
		terminalId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
	z.object({
		kind: z.literal("system"),
		operation: SystemOperationNameSchema,
		origin: SystemOriginSchema,
		tenantId: z.string().min(1).nullable(),
		/** Human on whose behalf the operation runs; null for background work with no user. */
		actorUserId: z.string().min(1).nullable(),
		/** Audit line for the system-operation transaction (`SystemDatabaseContext.reason`). */
		reason: z.string().min(1),
	}),
	z.object({
		kind: z.literal("anonymous"),
		/** Server-resolved tenant, or null when the request has no tenant. Never a client-supplied id. */
		tenantId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
	}),
	z.object({
		/**
		 * The subject of a verified refresh token (refresh and logout routes): a user
		 * whose access token is not on the request, so no session, role or scope is known.
		 * Scoped to that user without requiring a tenant, like `RlsInterceptor`.
		 */
		kind: z.literal("token_subject"),
		userId: z.string().min(1),
		tenantId: z.string().min(1).nullable(),
		request: RequestMetadataSchema,
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
 * The actor bound to the tenant its access was just verified for, so a unit of work's RLS session
 * is that tenant's (as the tenant transaction of the same request always was). Only a signed-in user is
 * re-bound; every other actor (an API key is bound to its own tenant) is returned unchanged.
 */
export function actingInTenant<TActor extends ActorContext>(actor: TActor, tenantId: string): TActor {
	return actor.kind === "user" ? { ...actor, tenantId } : actor;
}

/** Builds a validated system actor for jobs, cron, CLI, bootstrap, and consumers. */
export function systemActor(operation: SystemOperationName, origin: SystemOrigin, tenantId: string | null, reason: string, actorUserId: string | null): ActorContext {
	const parsed: ActorContext = ActorContextSchema.parse({
		kind: "system",
		operation: SystemOperationNameSchema.parse(operation),
		origin: SystemOriginSchema.parse(origin),
		tenantId,
		actorUserId,
		reason,
	});
	return parsed;
}
