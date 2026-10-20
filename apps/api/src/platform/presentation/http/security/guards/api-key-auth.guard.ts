import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { API_KEY_VERIFICATION, type ApiKeyAuthContext, type ApiKeyProvider, type ApiKeyVerificationPort } from "../../../../application/ports/api-key-verification.port";
import { RequestContextService } from "../../../../infrastructure/context/request-context";
import { rejectMachineTenantSelector } from "../../../../infrastructure/tenancy/machine-tenant-selector";
import { ALLOW_API_KEY_AUTH_KEY, extractApiKeyFromRequest, hasApiKeyAuthOnRequest, isJwtShapedToken, setApiKeyAuthOnRequest } from "../api-keys/api-key-request";
import { DEFAULT_ALLOWED_API_KEY_SCOPES, type AllowApiKeyAuthOptions } from "../decorators/allow-api-key-auth.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/** Providers tried when a route's options name none. */
const DEFAULT_API_KEY_PROVIDERS: readonly ApiKeyProvider[] = ["merchant"];

/**
 * Authenticates API keys on routes decorated with `@AllowApiKeyAuth()`.
 * Runs before `AuthGuard` — when a valid key is present, JWT auth is skipped.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
	public constructor(
		private readonly reflector: Reflector,
		@Inject(API_KEY_VERIFICATION) private readonly merchantApiKeys: ApiKeyVerificationPort,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (isPublic) {
			return true;
		}

		const options: AllowApiKeyAuthOptions | undefined =
			this.reflector.get<AllowApiKeyAuthOptions | undefined>(ALLOW_API_KEY_AUTH_KEY, context.getHandler()) ??
			this.reflector.get<AllowApiKeyAuthOptions | undefined>(ALLOW_API_KEY_AUTH_KEY, context.getClass());

		if (options === undefined) {
			return true;
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		if (hasApiKeyAuthOnRequest(request)) {
			return true;
		}

		const token = extractApiKeyFromRequest(request);
		if (token === undefined || isJwtShapedToken(token)) {
			return true;
		}

		const authContext = await this.authenticate(token, options.providers ?? DEFAULT_API_KEY_PROVIDERS);
		if (authContext === null) {
			throw new UnauthorizedException({
				message: "Invalid API key",
				error: "API_KEY_INVALID",
			});
		}

		const allowedScopes = options.scopes ?? DEFAULT_ALLOWED_API_KEY_SCOPES;
		if (!allowedScopes.includes(authContext.scope)) {
			throw new ForbiddenException({
				message: "This API key's scope does not allow this route",
				error: "API_KEY_SCOPE_FORBIDDEN",
				scope: authContext.scope,
			});
		}

		setApiKeyAuthOnRequest(request, authContext);
		rejectMachineTenantSelector(request);
		// The key is the request's principal (ADR 017): idempotency scoping and the audit trail read it here.
		this.requestContext.bindApiKey({
			apiKeyId: authContext.apiKeyId,
			tenantId: authContext.tenantId,
			terminalId: authContext.terminal?.terminalId,
			locationId: authContext.locationId,
		});
		return true;
	}

	/** The first provider that recognises the key, or null. */
	private async authenticate(plaintext: string, providers: readonly ApiKeyProvider[]): Promise<ApiKeyAuthContext | null> {
		return providers.includes("merchant") ? this.merchantApiKeys.verify(plaintext) : null;
	}
}
