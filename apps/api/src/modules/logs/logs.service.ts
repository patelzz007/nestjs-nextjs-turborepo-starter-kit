import { Injectable, Logger } from "@nestjs/common";

/**
 * Metadata shape for structured log entries.
 */
export interface LogMetadata {
	readonly [key: string]: string | number | boolean | null | undefined;
}

/**
 * Options for log entries — supports context, optional userId, and structured metadata.
 */
export interface LogOptions {
	/** The context/module name for the log entry (e.g. "AuthService") */
	readonly context?: string;
	/** Optional user identifier for the log entry */
	readonly userId?: string;
	/** Structured metadata for the log entry */
	readonly metadata?: LogMetadata;
}

/**
 * Application-level structured logging service.
 *
 * Wraps NestJS's built-in Logger and provides a consistent interface
 * for info, warn, and error log levels with metadata support.
 *
 * All log entries include:
 *  - A human-readable message
 *  - A context string (e.g. "AuthService")
 *  - Optional structured metadata (userId, email, etc.)
 *
 * Usage:
 * ```typescript
 * this.logService.info("User logged in", {
 *   context: "AuthService",
 *   metadata: { userId: user.id, email: user.email },
 * });
 * ```
 */
@Injectable()
export class LogService {
	private readonly logger: Logger = new Logger(LogService.name);

	/**
	 * Log an info-level message.
	 */
	public info(message: string, options?: LogOptions): void {
		const logContext: string = options?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, options);
		this.logger.log(formatted, logContext);
	}

	/**
	 * Log a warning-level message.
	 */
	public warn(message: string, options?: LogOptions): void {
		const logContext: string = options?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, options);
		this.logger.warn(formatted, logContext);
	}

	/**
	 * Log an error-level message.
	 */
	public error(message: string, options?: LogOptions & { trace?: string }): void {
		const logContext: string = options?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, options);
		this.logger.error(formatted, options?.trace, logContext);
	}

	/**
	 * Format a log message with optional metadata.
	 */
	private formatMessage(message: string, options?: LogOptions): string {
		if (!options?.metadata && !options?.userId) {
			return message;
		}

		const parts: Record<string, string | number | boolean | null | undefined> = {};

		if (options.userId !== undefined) {
			parts.userId = options.userId;
		}

		if (options.metadata) {
			for (const [key, value] of Object.entries(options.metadata)) {
				parts[key] = value;
			}
		}

		const metadataStr: string = JSON.stringify(parts);
		return `${message} | ${metadataStr}`;
	}
}
