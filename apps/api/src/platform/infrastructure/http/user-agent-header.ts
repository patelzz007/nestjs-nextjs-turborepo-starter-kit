import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

import { readFirstHeader } from "../utils/http-headers";

/** Longest User-Agent kept in the request context, audit rows, sessions and invitations. */
export const MAX_USER_AGENT_LENGTH = 512;

/** The `User-Agent` header, bounded to {@link MAX_USER_AGENT_LENGTH}. */
export function readUserAgentHeader(headers: IncomingHttpHeaders): string | undefined {
	return readFirstHeader(headers["user-agent"])?.slice(0, MAX_USER_AGENT_LENGTH);
}

/** The caller's User-Agent, bounded. */
export function readUserAgent(request: IncomingMessage): string | undefined {
	return readUserAgentHeader(request.headers);
}
