import type { FastifyRequest } from "fastify";

import { readUserAgentHeader } from "../http/user-agent-header";

/** The calling device and client IP, as stored on sessions, impersonation logs and invitations. */
export interface ClientInfo {
	readonly deviceInfo: string | undefined;
	readonly ipAddress: string | undefined;
}

/**
 * Device (User-Agent, bounded) and client IP of a request. The IP is Fastify's
 * `request.ip`, computed with the SAME trusted-proxy list and semantics as the
 * request context (`TRUST_PROXY`, platform/infrastructure/http/client-ip.ts): a forwarding
 * header from an untrusted peer is never believed.
 */
export function extractClientInfo(req: Pick<FastifyRequest, "headers" | "ip">): ClientInfo {
	return { deviceInfo: readUserAgentHeader(req.headers), ipAddress: req.ip };
}
