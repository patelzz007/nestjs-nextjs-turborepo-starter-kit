import { Injectable, Logger } from "@nestjs/common";

import { LogServiceOptionsSchema, type LogServiceOptions } from "@workspace/shared";

export type LogOptions = LogServiceOptions;

/**
 * Application-level structured logging service.
 *
 * Wraps NestJS's built-in Logger and provides a consistent interface
 * for info, warn, and error log levels with metadata support.
 */
@Injectable()
export class LogService {
	private readonly logger: Logger = new Logger(LogService.name);

	public info(message: string, options?: LogOptions): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.log(formatted, logContext);
	}

	public warn(message: string, options?: LogOptions): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.warn(formatted, logContext);
	}

	public error(message: string, options?: LogOptions & { trace?: string }): void {
		const parsed = options === undefined ? undefined : LogServiceOptionsSchema.parse(options);
		const logContext: string = parsed?.context ?? LogService.name;
		const formatted: string = this.formatMessage(message, parsed);
		this.logger.error(formatted, options?.trace, logContext);
	}

	private formatMessage(message: string, options?: LogOptions): string {
		if (options?.metadata === undefined && options?.userId === undefined) {
			return message;
		}

		const parts: Record<string, string | number | boolean | null> = {};

		if (options.userId !== undefined) {
			parts.userId = options.userId;
		}

		if (options.metadata !== undefined) {
			for (const [key, value] of Object.entries(options.metadata)) {
				parts[key] = value;
			}
		}

		const metadataStr: string = JSON.stringify(parts);
		return `${message} | ${metadataStr}`;
	}
}
