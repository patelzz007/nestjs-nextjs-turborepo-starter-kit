import type { FastifyRequest } from "fastify";

import { MAX_USER_AGENT_LENGTH } from "../middleware/request-context.middleware";
import { readFirstHeader } from "./http-headers";

/** The calling device and client IP, as stored on sessions, impersonation logs and invitations. */
export interface ClientInfo {
	readonly deviceInfo: string | undefined;
	readonly ipAddress: string | undefined;
}

/**
 * Device (User-Agent, bounded) and client IP of a request. The IP is Fastify's
 * `request.ip`, computed with the SAME trusted-proxy list and semantics as the
 * request context (`TRUST_PROXY`, common/http/client-ip.ts): a forwarding
 * header from an untrusted peer is never believed.
 */
export function extractClientInfo(req: Pick<FastifyRequest, "headers" | "ip">): ClientInfo {
	return { deviceInfo: readFirstHeader(req.headers["user-agent"])?.slice(0, MAX_USER_AGENT_LENGTH), ipAddress: req.ip };
}
