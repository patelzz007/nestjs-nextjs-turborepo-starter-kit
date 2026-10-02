import type { IncomingMessage, ServerResponse } from "node:http";

import { Injectable, type NestMiddleware } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { CORRELATION_ID_HEADER, correlationIdFor } from "../context/correlation-id";
import { RequestContextService } from "../context/request-context";
import { readFirstHeader } from "../utils/http-headers";

/** Longest User-Agent kept in the context (and in audit rows). */
export const MAX_USER_AGENT_LENGTH = 512;

const FORWARDED_FOR_SEPARATOR = ",";

/**
 * Client IP with the same semantics as Fastify's `request.ip`: the leftmost
 * `X-Forwarded-For` hop when `TRUST_PROXY` is on, the socket peer otherwise
 * (a client can forge `X-Forwarded-For`, so it is ignored unless a trusted
 * proxy sets it).
 */
export function resolveClientIp(request: IncomingMessage, trustProxy: boolean): string | undefined {
	if (trustProxy) {
		const forwardedFor: string | undefined = readFirstHeader(request.headers["x-forwarded-for"]);
		const firstHop: string | undefined = forwardedFor?.split(FORWARDED_FOR_SEPARATOR)[0]?.trim();
		if (firstHop !== undefined && firstHop.length > 0) {
			return firstHop;
		}
	}
	return request.socket.remoteAddress;
}

/** The caller's User-Agent, bounded. */
export function readUserAgent(request: IncomingMessage): string | undefined {
	return readFirstHeader(request.headers["user-agent"])?.slice(0, MAX_USER_AGENT_LENGTH);
}

/**
 * Request start: opens the request context (ADR 017) for everything that
 * runs after it — guards, interceptors, handlers, services — and echoes the
 * correlation id in `X-Correlation-Id`.
 *
 * On the Fastify adapter Nest middleware runs (via middie) during
 * `onRequest` against the RAW `IncomingMessage`; the correlation id is
 * resolved through `correlationIdFor`, so it matches Fastify's `request.id`
 * (`genReqId` in main.ts) exactly.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
	public constructor(
		private readonly requestContext: RequestContextService,
		private readonly config: TypedConfigService,
	) {}

	public use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
		const correlationId: string = correlationIdFor(request);
		response.setHeader(CORRELATION_ID_HEADER, correlationId);
		this.requestContext.run({ correlationId, ip: resolveClientIp(request, this.config.trustProxy), userAgent: readUserAgent(request) }, next);
	}
}
