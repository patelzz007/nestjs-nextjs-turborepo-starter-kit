import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { nanoid } from "nanoid";

import type { JsonValue } from "../interfaces/json";

/**
 * The raw Node request as seen by Nest middleware on the Fastify adapter.
 *
 * Nest middleware is executed by middie at Fastify's `onRequest` phase, which
 * hands the middleware the RAW `IncomingMessage` (`request.raw`), not the
 * FastifyRequest. `originalUrl` is patched onto it by middie; this middleware
 * attaches the correlation/trace ids on top.
 */
export interface RequestWithTrace extends IncomingMessage {
	correlationId?: string;
	traceId?: string;
	responseData?: JsonValue;
}

/**
 * Middleware that attaches a correlation ID and trace ID to every incoming request.
 *
 * - **correlationId**: Generated per request (or forwarded from client via `X-Correlation-Id` header).
 *   Used for log correlation tracing across services.
 * - **traceId**: Alias for correlationId, used for request grouping in the terminal output.
 *
 * The middleware also sets the `X-Correlation-Id` response header for client-side tracing.
 *
 * On the Fastify adapter this runs against `request.raw` (see {@link RequestWithTrace});
 * a `preHandler` hook in `main.ts` mirrors `correlationId`/`traceId` onto the
 * FastifyRequest so guards/interceptors can read them.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
	public use(req: RequestWithTrace, res: ServerResponse, next: () => void): void {
		// Generate or forward correlation ID
		const headerValue: string | string[] | undefined = req.headers["x-correlation-id"] ?? req.headers["x-request-id"];
		const correlationId: string = typeof headerValue === "string" ? headerValue : nanoid();

		req.correlationId = correlationId;
		req.traceId = correlationId;

		// Attach correlation ID to response headers for client-side tracing
		res.setHeader("X-Correlation-Id", correlationId);

		next();
	}
}
