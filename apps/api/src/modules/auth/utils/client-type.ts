import { AuthClientTypeSchema, CLIENT_TYPE_HEADER, FastifyQuerySchema, type AuthClientType } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { readFirstHeader, readQueryParam } from "../../../common/utils/http-headers";

/** `?client_type=` — the fallback for callers that cannot set `X-Client-Type` (Swagger UI's "Try it out"). */
const CLIENT_TYPE_QUERY_PARAM = "client_type";

/** The client type of a request that declares none (or an unknown one): the consumer web app, as before client types existed. */
export const DEFAULT_CLIENT_TYPE: AuthClientType = AuthClientTypeSchema.enum.web;

/**
 * The validated client type of a request — the ONE place the API decides it,
 * shared by the auth guard, the refresh guard, the token-delivery and
 * cookie-clearing interceptors, the mutation-intent guard and the mobile
 * version guard, so they can never disagree about a request.
 *
 * `X-Client-Type` first, then `?client_type=`; parsed with the shared
 * `AuthClientTypeSchema`. Absent or unrecognized values resolve to `web`
 * (exact, case-sensitive match — `Mobile` is not `mobile`).
 *
 * The client type selects a token TRANSPORT, never a permission (ADR 029):
 * declaring `mobile` from a browser only switches that request to bearer /
 * body tokens, which a page cannot obtain from its httpOnly cookies.
 */
export function resolveRequestClientType(request: Pick<FastifyRequest, "headers" | "query">): AuthClientType {
	const header: string | undefined = readFirstHeader(request.headers[CLIENT_TYPE_HEADER.toLowerCase()]);
	const query = FastifyQuerySchema.safeParse(request.query);
	const declared: string | undefined = header ?? (query.success ? readQueryParam(query.data, CLIENT_TYPE_QUERY_PARAM) : undefined);
	const parsed = AuthClientTypeSchema.safeParse(declared);
	return parsed.success ? parsed.data : DEFAULT_CLIENT_TYPE;
}
