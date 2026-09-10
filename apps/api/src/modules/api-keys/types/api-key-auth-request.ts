import type { FastifyRequest } from "fastify";

import { API_KEY_AUTH_CONTEXT_KEY, type ApiKeyAuthContext } from "./api-key-auth.types";
import { MERCHANT_ACTOR_KEY, type MerchantActor } from "./merchant-actor.types";

export type ApiKeyAuthRequest = FastifyRequest & {
	readonly [API_KEY_AUTH_CONTEXT_KEY]?: ApiKeyAuthContext;
	readonly [MERCHANT_ACTOR_KEY]?: MerchantActor;
};

export function asApiKeyAuthRequest(request: FastifyRequest): ApiKeyAuthRequest {
	return request;
}

export function getApiKeyAuthFromRequest(request: FastifyRequest): ApiKeyAuthContext | undefined {
	return asApiKeyAuthRequest(request)[API_KEY_AUTH_CONTEXT_KEY];
}

export function hasApiKeyAuthOnRequest(request: FastifyRequest): boolean {
	return getApiKeyAuthFromRequest(request) !== undefined;
}

export function setApiKeyAuthOnRequest(request: FastifyRequest, authContext: ApiKeyAuthContext): void {
	Object.assign(request, { [API_KEY_AUTH_CONTEXT_KEY]: authContext });
}

export function getMerchantActorFromRequest(request: FastifyRequest): MerchantActor | undefined {
	return asApiKeyAuthRequest(request)[MERCHANT_ACTOR_KEY];
}

export function setMerchantActorOnRequest(request: FastifyRequest, actor: MerchantActor): void {
	Object.assign(request, { [MERCHANT_ACTOR_KEY]: actor });
}
