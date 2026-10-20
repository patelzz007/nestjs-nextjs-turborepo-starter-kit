import type { FastifyRequest } from "fastify";

import type { ApiKeyAuthContext } from "../../../../application/ports/api-key-verification.port";
import type { TillPoint } from "../../../../application/ports/till-resolution.port";
import { readFirstHeader } from "../../../../infrastructure/utils/http-headers";
import { MERCHANT_ACTOR_KEY, type MerchantActor } from "./merchant-actor";

/** Metadata key for routes that accept API key authentication. */
export const ALLOW_API_KEY_AUTH_KEY = "allowApiKeyAuth";

/** Request property the verified API key context is attached under. */
export const API_KEY_AUTH_CONTEXT_KEY = "apiKeyAuth";

/** Request property the POS guard attaches the resolved till under. */
export const TILL_POINT_KEY = "posTillPoint";

/** Length of the `Bearer ` scheme prefix of an `Authorization` header. */
const BEARER_PREFIX = "Bearer ";

/** JWTs are three base64url segments separated by dots. */
const JWT_SEGMENTS = 3;

export type ApiKeyAuthRequest = FastifyRequest & {
	readonly [API_KEY_AUTH_CONTEXT_KEY]?: ApiKeyAuthContext;
	readonly [MERCHANT_ACTOR_KEY]?: MerchantActor;
	readonly [TILL_POINT_KEY]?: TillPoint;
};

/** A route read the till before the POS guard resolved it: it is mis-wired. */
export class TillPointMissingError extends Error {
	public constructor() {
		super("POS till context missing — apply MerchantApiKeyGuard before reading it");
		this.name = "TillPointMissingError";
	}
}

export function getApiKeyAuthFromRequest(request: ApiKeyAuthRequest): ApiKeyAuthContext | undefined {
	return request[API_KEY_AUTH_CONTEXT_KEY];
}

export function hasApiKeyAuthOnRequest(request: ApiKeyAuthRequest): boolean {
	return getApiKeyAuthFromRequest(request) !== undefined;
}

export function setApiKeyAuthOnRequest(request: FastifyRequest, authContext: ApiKeyAuthContext): void {
	Object.assign(request, { [API_KEY_AUTH_CONTEXT_KEY]: authContext });
}

export function getMerchantActorFromRequest(request: ApiKeyAuthRequest): MerchantActor | undefined {
	return request[MERCHANT_ACTOR_KEY];
}

export function setMerchantActorOnRequest(request: FastifyRequest, actor: MerchantActor): void {
	Object.assign(request, { [MERCHANT_ACTOR_KEY]: actor });
}

export function setTillPointOnRequest(request: FastifyRequest, point: TillPoint): void {
	Object.assign(request, { [TILL_POINT_KEY]: point });
}

/** The till the POS guard resolved; throws {@link TillPointMissingError} on a route without the guard. */
export function getTillPointFromRequest(request: ApiKeyAuthRequest): TillPoint {
	const point = request[TILL_POINT_KEY];
	if (point === undefined) {
		throw new TillPointMissingError();
	}
	return point;
}

/** A raw API key from `Authorization: Bearer` or `X-API-Key`. */
export function extractApiKeyFromRequest(request: FastifyRequest): string | undefined {
	const authorization = readFirstHeader(request.headers.authorization);
	if (authorization?.startsWith(BEARER_PREFIX) === true) {
		const bearer = authorization.slice(BEARER_PREFIX.length);
		if (bearer.length > 0) {
			return bearer;
		}
	}
	const headerKey = readFirstHeader(request.headers["x-api-key"]);
	return headerKey !== undefined && headerKey.length > 0 ? headerKey : undefined;
}

/** Whether a bearer token is a JWT (three base64url segments) rather than an API key. */
export function isJwtShapedToken(token: string): boolean {
	return token.split(".").length === JWT_SEGMENTS;
}

/** The first value of a request header, or undefined when absent. */
export function requestHeader(request: FastifyRequest, name: string): string | undefined {
	return readFirstHeader(request.headers[name]);
}
