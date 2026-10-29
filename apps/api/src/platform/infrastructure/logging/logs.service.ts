import { Injectable, Logger } from "@nestjs/common";

import { LogServiceOptionsSchema, MetadataValueSchema, type LogServiceOptions } from "@workspace/shared";

import { RequestContextService, type RequestLogFields } from "../context/request-context";
import { redactSecrets } from "../nest-logging/redaction";

export type LogOptions = LogServiceOptions;

/**
 * Application-level structured logging service.
 *
 * Wraps NestJS's built-in Logger and provides a consistent interface
 * for info, warn, and error log levels with metadata support. (Memory leak
 * detection is a separate concern: `memory/memory-monitor.service.ts`.)
 *
 * Every line written inside a request carries that request's `correlationId`
 * (plus `userId` / `impersonatorId` / `tenantId` once known), read from
 * the one request context (ADR 017) — callers never thread it through.
 */
@Injectable()
export class LogService {
	private readonly logger: Logger = new Logger(LogService.name);

	public constructor(private readonly requestContext: RequestContextService) {}

	public info(message: string, options?: LogOptions): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.log(formatted, logContext);
	}

	/** A warning; with `trace` (a stack), the stack is printed under the message — Nest's `warn` has no stack argument. */
	public warn(message: string, options?: LogOptions & { trace?: string | undefined }): void {
		const { trace, ...logOptions } = options ?? {};
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(logOptions);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.warn(trace === undefined ? formatted : `${formatted}\n${trace}`, logContext);
	}

	public error(message: string, options?: LogOptions & { trace?: string | undefined }): void {
		// `trace` is not part of the strict LogServiceOptionsSchema — split it off
		// before validation (otherwise every call that passes a stack trace threw).
		const { trace, ...logOptions } = options ?? {};
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(logOptions);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.error(formatted, trace, logContext);
	}

	private formatMessage(message: string, options?: LogOptions): string {
		const requestFields: RequestLogFields | undefined = this.requestContext.logFields();
		if (options?.metadata === undefined && options?.userId === undefined && requestFields === undefined) {
			return message;
		}

		const parts: Record<string, string | number | boolean | null> = {};

		// Request identifiers first; an explicit `userId` option wins.
		if (requestFields !== undefined) {
			parts.correlationId = requestFields.correlationId;
			if (requestFields.userId !== undefined) {
				parts.userId = requestFields.userId;
			}
			if (requestFields.impersonatorId !== undefined) {
				parts.impersonatorId = requestFields.impersonatorId;
			}
			if (requestFields.tenantId !== undefined) {
				parts.tenantId = requestFields.tenantId;
			}
		}

		if (options?.userId !== undefined) {
			parts.userId = options.userId;
		}

		if (options?.metadata !== undefined) {
			// Centralized redaction (platform/infrastructure/nest-logging/redaction.ts): secrets never
			// reach the log line, whatever key casing/separator the caller used.
			const redacted = MetadataValueSchema.parse(redactSecrets(options.metadata));
			for (const [key, value] of Object.entries(redacted)) {
				parts[key] = value;
			}
		}

		const metadataStr: string = JSON.stringify(parts);
		return `${message} | ${metadataStr}`;
	}
}
