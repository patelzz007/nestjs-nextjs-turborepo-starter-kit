// ============================================
// common/logging/nest-log-levels.ts - LOG_LEVEL → Nest logger levels
// ============================================
// LOG_LEVEL is the ONE log-level setting of the API, in every environment:
// pino (Fastify's request logger), Prisma event logging AND every Nest
// `Logger` (`new Logger(Service.name)`) follow it. Nest has its own level
// names, so the pino-style LOG_LEVEL is translated here; nothing else may
// hard-code which Nest levels print.
import type { LogLevel as NestLogLevel } from "@nestjs/common";

import type { LogLevel } from "../../config/api-env.fields";

/** Nest's levels, most severe first: a threshold prints itself and everything before it. */
const NEST_LEVELS_BY_SEVERITY: readonly NestLogLevel[] = ["fatal", "error", "warn", "log", "debug", "verbose"];

/** The least severe Nest level each (non-silent) LOG_LEVEL still prints. */
const NEST_THRESHOLD_BY_LOG_LEVEL: Readonly<Record<Exclude<LogLevel, "silent">, NestLogLevel>> = {
	fatal: "fatal",
	error: "error",
	warn: "warn",
	info: "log",
	debug: "debug",
	trace: "verbose",
};

/**
 * The value for `NestFactory.create(…, { logger })`: the Nest levels the
 * configured LOG_LEVEL lets through, or `false` (Nest logging off) for
 * `silent`.
 */
export function nestLoggerLevelsFor(level: LogLevel): NestLogLevel[] | false {
	if (level === "silent") {
		return false;
	}
	const threshold: NestLogLevel = NEST_THRESHOLD_BY_LOG_LEVEL[level];
	return NEST_LEVELS_BY_SEVERITY.slice(0, NEST_LEVELS_BY_SEVERITY.indexOf(threshold) + 1);
}
