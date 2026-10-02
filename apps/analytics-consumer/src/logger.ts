import type { ConsumerLogEntry, ConsumerLogger } from "./message-handler";

type LogLevel = "info" | "warn" | "error";

/** One JSON object per line on stdout/stderr — structured, queryable (rules/12). */
export function formatLogLine(service: string, level: LogLevel, entry: ConsumerLogEntry, timestampEpochMs: number): string {
	return JSON.stringify({ ...entry, level, service, timestampEpochMs });
}

export function createConsoleJsonLogger(service: string, now: () => number = Date.now): ConsumerLogger {
	return {
		info: (entry: ConsumerLogEntry): void => {
			console.log(formatLogLine(service, "info", entry, now()));
		},
		warn: (entry: ConsumerLogEntry): void => {
			console.warn(formatLogLine(service, "warn", entry, now()));
		},
		error: (entry: ConsumerLogEntry): void => {
			console.error(formatLogLine(service, "error", entry, now()));
		},
	};
}
