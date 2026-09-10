import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { getApiKeyAuthFromRequest } from "../types/api-key-auth-request";
import type { ApiKeyAuthContext } from "../types/api-key-auth.types";

/** Extract the verified API key context from the request (if present). */
export const GetApiKeyAuth = createParamDecorator((_data: undefined, ctx: ExecutionContext): ApiKeyAuthContext => {
	const request: FastifyRequest = ctx.switchToHttp().getRequest<FastifyRequest>();
	const authContext = getApiKeyAuthFromRequest(request);

	if (authContext === undefined) {
		throw new UnauthorizedException({
			message: "API key authentication required",
			error: "API_KEY_AUTH_REQUIRED",
		});
	}

	return authContext;
});
