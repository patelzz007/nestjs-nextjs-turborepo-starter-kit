import type { FastifyRequest } from "fastify";

import { extractClientInfo } from "../../../infrastructure/utils/client-info";

/** The caller's IP and raw User-Agent as an audited security action records them (impersonation start and stop). */
export interface RequestClientInfo {
	/** Fastify's trusted-proxy-aware `request.ip`. */
	readonly ipAddress: string | null;
	/** The User-Agent header as sent, or `null`. */
	readonly userAgent: string | null;
}

export function clientInfoOf(request: Pick<FastifyRequest, "headers" | "ip">): RequestClientInfo {
	return { ipAddress: extractClientInfo(request).ipAddress ?? null, userAgent: request.headers["user-agent"] ?? null };
}
