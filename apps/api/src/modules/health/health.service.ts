import { Inject, Injectable, Optional } from "@nestjs/common";

import {
	HealthResponseSchema,
	LivenessResponseSchema,
	nowEpochMs,
	ReadinessResponseSchema,
	type DeepHealthResponse,
	type HealthResponse,
	type LivenessResponse,
	type ModuleHealth,
	type ModuleHealthDetailValue,
	type ReadinessCheck,
	type ReadinessResponse,
} from "@workspace/shared";

import { DependencyUnavailableError } from "../../common/errors/app-error";
import { PrismaService } from "../../prisma/prisma.service";

/** Scalar value a module health report may carry. */
export type ModuleHealthReportValue = string | number | boolean | bigint | null;

/** Detailed per-module health report. */
export type ModuleHealthReport = Readonly<Record<string, ModuleHealthReportValue>>;

/**
 * Maps a module report to its JSON-safe contract shape (`ModuleHealthSchema.details`):
 * a `bigint` (a Prisma epoch-ms column, a counter) is sent as a number.
 */
export function toModuleHealthDetails(report: ModuleHealthReport): Record<string, ModuleHealthDetailValue> {
	return Object.fromEntries(
		Object.entries(report).map(([key, value]: readonly [string, ModuleHealthReportValue]): readonly [string, ModuleHealthDetailValue] => [
			key,
			typeof value === "bigint" ? Number(value) : value,
		]),
	);
}

/**
 * Optional injection token for module health indicators.
 * Each module registers its own health indicator that gets aggregated here.
 */
export const MODULE_HEALTH_INDICATORS = "MODULE_HEALTH_INDICATORS";

/** Interface for module health indicators */
export interface ModuleHealthIndicator {
	readonly isHealthy: () => Promise<boolean>;
	readonly getReport?: () => Promise<ModuleHealthReport>;
}

/** One registered indicator plus whether readiness depends on it. */
export interface RegisteredModuleHealthIndicator {
	readonly name: string;
	readonly indicator: ModuleHealthIndicator;
	/**
	 * `true` → a failing probe makes `GET /health/ready` answer 503 and the
	 * load balancer stops routing to this instance. Only mark a dependency
	 * critical when the API genuinely cannot serve traffic without it —
	 * every instance fails the same probe at the same moment, so a
	 * non-essential dependency marked critical turns a blip into a full outage.
	 */
	readonly critical: boolean;
}

/** Upper bound for any single readiness probe — a hung dependency must not hang the probe. */
export const HEALTH_PROBE_TIMEOUT_MS = 2_000;

/** Readiness probe names that are not module indicators. */
const STARTUP_PROBE = "startup";
const DATABASE_PROBE = "database";

/** Resolves to `false` instead of hanging when `probe` does not settle within the timeout. */
async function probeWithTimeout(probe: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<boolean>((resolve: (value: boolean) => void): void => {
		timer = setTimeout((): void => {
			resolve(false);
		}, timeoutMs);
	});
	try {
		return await Promise.race([probe().catch((): boolean => false), timeout]);
	} finally {
		clearTimeout(timer);
	}
}

@Injectable()
export class HealthService {
	/** Set to true once the API has fully started (DB connected, Swagger built). */
	private ready = false;

	public constructor(
		private readonly prisma: PrismaService,
		@Optional()
		@Inject(MODULE_HEALTH_INDICATORS)
		private readonly moduleIndicators: readonly RegisteredModuleHealthIndicator[] = [],
	) {}

	/** Mark the API as ready to serve (called from main.ts after startup). */
	public markReady(): void {
		this.ready = true;
	}

	/** Mark the API as shutting down so health probes fail fast during graceful exit. */
	public markNotReady(): void {
		this.ready = false;
	}

	public getHello(): string {
		return "Hello from the Freebuff API!";
	}

	/**
	 * Liveness: the process is up and its event loop answers. Never touches
	 * the database or the readiness flag — a restart would not fix a database
	 * outage, and killing a draining instance mid-shutdown loses requests.
	 */
	public liveness(): LivenessResponse {
		return LivenessResponseSchema.parse({
			status: "ok",
			uptimeSeconds: process.uptime(),
			timestamp: nowEpochMs(),
		});
	}

	/**
	 * Readiness: can this instance serve traffic right now? Fails (503 with
	 * the per-probe `checks` in `error.details`) when startup has not finished
	 * or shutdown began, the database does not answer within
	 * {@link HEALTH_PROBE_TIMEOUT_MS}, or a CRITICAL module indicator fails.
	 * Non-critical indicators are reported but never flip readiness.
	 */
	public async readiness(): Promise<ReadinessResponse> {
		const [databaseUp, moduleResults] = await Promise.all([
			probeWithTimeout(() => this.pingDatabase(), HEALTH_PROBE_TIMEOUT_MS),
			Promise.all(
				this.moduleIndicators.map(async ({ name, indicator, critical }: RegisteredModuleHealthIndicator): Promise<ReadinessCheck> => {
					const healthy: boolean = await probeWithTimeout(() => indicator.isHealthy(), HEALTH_PROBE_TIMEOUT_MS);
					return { name, status: healthy ? "up" : "down", critical };
				}),
			),
		]);

		const checks: ReadinessCheck[] = [
			{ name: STARTUP_PROBE, status: this.ready ? "up" : "down", critical: true },
			{ name: DATABASE_PROBE, status: databaseUp ? "up" : "down", critical: true },
			...moduleResults,
		];

		const isReady: boolean = checks.every((check: ReadinessCheck): boolean => !check.critical || check.status === "up");
		if (!isReady) {
			throw new DependencyUnavailableError({
				message: "The API is not ready to serve traffic.",
				details: {
					status: "not_ready",
					checks,
				},
			});
		}

		return ReadinessResponseSchema.parse({ status: "ready", checks, timestamp: nowEpochMs() });
	}

	/**
	 * Legacy `GET /health` probe — kept for existing uptime monitors. Prefer
	 * `/health/live` (liveness) and `/health/ready` (readiness). Note it
	 * answers 200 with `db: "disconnected"` when the database is down.
	 */
	public async healthCheck(): Promise<HealthResponse> {
		if (!this.ready) {
			throw new DependencyUnavailableError({ message: "API is starting up" });
		}

		const dbStatus: string = (await probeWithTimeout(() => this.pingDatabase(), HEALTH_PROBE_TIMEOUT_MS)) ? "connected" : "disconnected";

		return HealthResponseSchema.parse({
			status: "ok",
			db: dbStatus,
			timestamp: nowEpochMs(),
		});
	}

	public async deepHealthCheck(): Promise<DeepHealthResponse> {
		if (!this.ready) {
			throw new DependencyUnavailableError({ message: "API is starting up" });
		}

		const dbStatus: string = (await probeWithTimeout(() => this.pingDatabase(), HEALTH_PROBE_TIMEOUT_MS)) ? "connected" : "disconnected";

		// Run module health indicators
		const moduleHealthResults: ModuleHealth[] = [];
		for (const { name, indicator } of this.moduleIndicators) {
			try {
				const healthy = await indicator.isHealthy();
				const report = indicator.getReport !== undefined ? await indicator.getReport() : {};
				moduleHealthResults.push({ name, healthy, details: toModuleHealthDetails(report) });
			} catch {
				moduleHealthResults.push({ name, healthy: false, details: { error: "Health check failed" } });
			}
		}

		return {
			status: "ok",
			db: dbStatus,
			timestamp: nowEpochMs(),
			filesystem: "ok",
			checks: {},
			modules: moduleHealthResults,
		} satisfies DeepHealthResponse;
	}

	private async pingDatabase(): Promise<boolean> {
		await this.prisma.$queryRaw`SELECT 1`;
		return true;
	}
}
