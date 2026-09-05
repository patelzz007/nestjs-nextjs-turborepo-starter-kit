import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { readCaughtErrorMessage } from "../utils/caught-error";
import { LogService } from "../../modules/logs/logs.service";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

/** Minimal readiness surface used while the HTTP server shuts down. */
export interface ShutdownReadinessProbe {
	markNotReady(): void;
}

/** Reads `SHUTDOWN_TIMEOUT_MS` from the environment (falls back to 15s). */
export function readShutdownTimeoutMs(): number {
	const raw: string | undefined = process.env.SHUTDOWN_TIMEOUT_MS;
	if (raw === undefined || raw.trim() === "") {
		return DEFAULT_SHUTDOWN_TIMEOUT_MS;
	}
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_SHUTDOWN_TIMEOUT_MS;
	}
	return parsed;
}

/**
 * Registers SIGINT / SIGTERM / SIGHUP handlers that stop accepting HTTP traffic,
 * run Nest shutdown hooks (Prisma, Redis, BullMQ, Kafka, …), and exit cleanly.
 */
export function registerGracefulShutdown(app: NestFastifyApplication, healthService: ShutdownReadinessProbe, logService: LogService): void {
	const shutdownTimeoutMs: number = readShutdownTimeoutMs();
	let shutdownStarted = false;

	const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
		if (shutdownStarted) {
			return;
		}
		shutdownStarted = true;

		healthService.markNotReady();
		logService.info(`Received ${signal} — shutting down gracefully (timeout ${String(shutdownTimeoutMs)}ms)…`);

		const forceExitTimer: NodeJS.Timeout = setTimeout((): void => {
			logService.error(`Graceful shutdown timed out after ${String(shutdownTimeoutMs)}ms — forcing exit`);
			process.exit(1);
		}, shutdownTimeoutMs);

		try {
			await app.close();
			clearTimeout(forceExitTimer);
			logService.info("Graceful shutdown complete — HTTP server and connections closed");
			process.exit(0);
		} catch (error) {
			clearTimeout(forceExitTimer);
			logService.error(`Graceful shutdown failed: ${readCaughtErrorMessage(error)}`);
			process.exit(1);
		}
	};

	process.once("SIGINT", (): void => {
		void shutdown("SIGINT");
	});
	process.once("SIGTERM", (): void => {
		void shutdown("SIGTERM");
	});
	process.once("SIGHUP", (): void => {
		void shutdown("SIGHUP");
	});
}
