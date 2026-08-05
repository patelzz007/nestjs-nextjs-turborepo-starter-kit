import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

import type { JsonValue } from "../../types/json.js";

/**
 * Extended Express Request interface that includes correlation ID, trace info,
 * and response data captured by the ResponseInterceptor for terminal logging.
 */
export interface RequestWithTrace extends Request {
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
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
	public use(req: RequestWithTrace, res: Response, next: NextFunction): void {
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
