import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { IS_PUBLIC_KEY } from "../../auth/decorators/public.decorator";
import { ALLOW_API_KEY_AUTH_KEY } from "../constants/api-key-auth.constants";
import type { AllowApiKeyAuthOptions } from "../decorators/allow-api-key-auth.decorator";
import { ApiKeyAuthService } from "../services/api-key-auth.service";
import { hasApiKeyAuthOnRequest, setApiKeyAuthOnRequest } from "../types/api-key-auth-request";
import { extractApiKeyFromRequest } from "../utils/extract-api-key.util";
import { isJwtShapedToken } from "../utils/is-jwt-shaped.util";

/**
 * Authenticates API keys on routes decorated with `@AllowApiKeyAuth()`.
 * Runs before `AuthGuard` — when a valid key is present, JWT auth is skipped.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
	public constructor(
		private readonly reflector: Reflector,
		private readonly apiKeyAuthService: ApiKeyAuthService,
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

		const authContext = await this.apiKeyAuthService.authenticate(token, options);
		if (authContext === null) {
			throw new UnauthorizedException({
				message: "Invalid API key",
				error: "API_KEY_INVALID",
			});
		}

		setApiKeyAuthOnRequest(request, authContext);
		return true;
	}
}
