import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { CaughtValueSchema } from "@workspace/shared";
import type { BullMqWorkerDrainService } from "@workspace/messaging/nest";

import { readCaughtErrorMessage } from "../utils/caught-error";
import type { LogService } from "../../modules/logs/logs.service";

/** Minimal readiness surface used while the HTTP server shuts down. */
export interface ShutdownReadinessProbe {
	markNotReady(): void;
}

/** Exit code after a clean shutdown. */
const EXIT_OK = 0;
/** Exit code when shutdown failed or timed out. */
const EXIT_FAILURE = 1;

/** Everything one shutdown run touches — injected so the sequence is testable without a process. */
export interface GracefulShutdownDependencies {
	readonly app: Pick<NestFastifyApplication, "close">;
	readonly readiness: ShutdownReadinessProbe;
	readonly log: Pick<LogService, "info" | "error">;
	readonly workerDrain: Pick<BullMqWorkerDrainService, "drain">;
	readonly shutdownTimeoutMs: number;
	readonly exit: (code: number) => void;
}

/**
 * One graceful shutdown, in order:
 *
 * 1. mark the instance not ready (the load balancer stops routing to it);
 * 2. DRAIN the BullMQ workers — no new jobs, running jobs finish — while the
 *    database pool, Kafka and Redis are still open. Nest's own teardown
 *    (`app.close()`) ends those in `onModuleDestroy`, BEFORE `@nestjs/bullmq`
 *    closes its workers, so skipping this step fails any in-flight job;
 * 3. `app.close()` — HTTP server, Nest shutdown hooks (Prisma, Redis, Kafka, …);
 * 4. exit — `0` when clean, `1` on failure or after `shutdownTimeoutMs`.
 */
export async function runGracefulShutdown(signal: NodeJS.Signals, deps: GracefulShutdownDependencies): Promise<void> {
	deps.readiness.markNotReady();
	deps.log.info(`Received ${signal} — shutting down gracefully (timeout ${String(deps.shutdownTimeoutMs)}ms)…`);

	const forceExitTimer: NodeJS.Timeout = setTimeout((): void => {
		deps.log.error(`Graceful shutdown timed out after ${String(deps.shutdownTimeoutMs)}ms — forcing exit`);
		deps.exit(EXIT_FAILURE);
	}, deps.shutdownTimeoutMs);

	try {
		const drained: number = await deps.workerDrain.drain();
		deps.log.info(`Drained ${String(drained)} BullMQ worker(s)`);
		await deps.app.close();
		clearTimeout(forceExitTimer);
		deps.log.info("Graceful shutdown complete — HTTP server and connections closed");
		deps.exit(EXIT_OK);
	} catch (error) {
		clearTimeout(forceExitTimer);
		const parsed = CaughtValueSchema.safeParse(error);
		const message = parsed.success ? readCaughtErrorMessage(parsed.data) : "unknown error";
		deps.log.error(`Graceful shutdown failed: ${message}`);
		deps.exit(EXIT_FAILURE);
	}
}

/**
 * Registers SIGINT / SIGTERM / SIGHUP handlers that run {@link runGracefulShutdown}
 * once. `shutdownTimeoutMs` comes from the validated config (`SHUTDOWN_TIMEOUT_MS`).
 */
export function registerGracefulShutdown(
	app: NestFastifyApplication,
	healthService: ShutdownReadinessProbe,
	logService: LogService,
	workerDrain: Pick<BullMqWorkerDrainService, "drain">,
	shutdownTimeoutMs: number,
): void {
	let shutdownStarted = false;
	const deps: GracefulShutdownDependencies = {
		app,
		readiness: healthService,
		log: logService,
		workerDrain,
		shutdownTimeoutMs,
		exit: (code: number): void => {
			process.exit(code);
		},
	};

	const shutdown = (signal: NodeJS.Signals): void => {
		if (shutdownStarted) {
			return;
		}
		shutdownStarted = true;
		void runGracefulShutdown(signal, deps);
	};

	process.once("SIGINT", (): void => {
		shutdown("SIGINT");
	});
	process.once("SIGTERM", (): void => {
		shutdown("SIGTERM");
	});
	process.once("SIGHUP", (): void => {
		shutdown("SIGHUP");
	});
}
