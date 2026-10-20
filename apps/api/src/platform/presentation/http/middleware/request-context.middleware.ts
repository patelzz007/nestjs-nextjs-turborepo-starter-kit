import type { IncomingMessage, ServerResponse } from "node:http";

import { Injectable, type NestMiddleware } from "@nestjs/common";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { CORRELATION_ID_HEADER, correlationIdFor } from "../../../infrastructure/context/correlation-id";
import { RequestContextService } from "../../../infrastructure/context/request-context";
import { resolveClientIp, TrustedProxies } from "../../../infrastructure/http/client-ip";
import { readEdgeLocation, type RequestEdgeLocation } from "../../../infrastructure/http/edge-location";
import { readUserAgent } from "../../../infrastructure/http/user-agent-header";
import { readFirstHeader } from "../../../infrastructure/utils/http-headers";

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
	private readonly trustedProxies: TrustedProxies;

	public constructor(
		private readonly requestContext: RequestContextService,
		config: TypedConfigService,
	) {
		this.trustedProxies = new TrustedProxies(config.http.trustedProxies);
	}

	public use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
		const correlationId: string = correlationIdFor(request);
		response.setHeader(CORRELATION_ID_HEADER, correlationId);
		this.requestContext.run(
			{
				correlationId,
				ip: resolveClientIp(request.socket.remoteAddress, readFirstHeader(request.headers["x-forwarded-for"]), this.trustedProxies),
				userAgent: readUserAgent(request),
				edgeLocation: this.edgeLocationOf(request),
			},
			next,
		);
	}

	/** The CDN's geo headers — read only from a trusted proxy, so a direct client cannot claim a location. */
	private edgeLocationOf(request: IncomingMessage): RequestEdgeLocation | undefined {
		const peer: string | undefined = request.socket.remoteAddress;
		return peer !== undefined && this.trustedProxies.isTrusted(peer) ? readEdgeLocation(request.headers) : undefined;
	}
}
