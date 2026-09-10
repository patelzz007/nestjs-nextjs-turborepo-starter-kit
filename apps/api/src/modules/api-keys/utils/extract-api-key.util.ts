import type { FastifyRequest } from "fastify";

import { readFirstHeader } from "../../../common/utils/http-headers";

/** Extract a raw API key from `Authorization: Bearer` or `X-API-Key`. */
export function extractApiKeyFromRequest(request: FastifyRequest): string | undefined {
	const authorization = readFirstHeader(request.headers.authorization);
	if (authorization?.startsWith("Bearer ")) {
		const bearer = authorization.slice(7);
		if (bearer.length > 0) {
			return bearer;
		}
	}

	const headerKey = readFirstHeader(request.headers["x-api-key"]);
	if (headerKey !== undefined && headerKey.length > 0) {
		return headerKey;
	}

	return undefined;
}
