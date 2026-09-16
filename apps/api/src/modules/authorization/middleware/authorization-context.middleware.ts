import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function readStringField(source: unknown, key: string): string | undefined {
	if (!isRecord(source)) {
		return undefined;
	}
	const value = source[key];
	return typeof value === "string" ? value : undefined;
}

/**
 * Authorization Context Middleware
 *
 * Extracts common authorization context from the request and attaches it
 * to `request.authorizationContext` for use by the AuthorizationGuard.
 */
@Injectable()
export class AuthorizationContextMiddleware implements NestMiddleware {
	public use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
		const organizationId =
			readStringField(req.body, "organizationId") ??
			readStringField(req.params, "organizationId") ??
			readStringField(req.params, "orgId") ??
			readStringField(req.params, "orgSlug") ??
			readStringField(req.query, "organizationId") ??
			null;

		const locationId = readStringField(req.body, "locationId") ?? readStringField(req.params, "locationId") ?? readStringField(req.query, "locationId") ?? null;

		const resourceId = readStringField(req.params, "id") ?? readStringField(req.params, "resourceId") ?? null;

		req.authorizationContext = {
			organizationId,
			locationId,
			resourceId,
		};

		next();
	}
}
