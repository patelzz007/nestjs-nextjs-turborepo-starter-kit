import { Inject, Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";

import { HealthResponseSchema, nowEpochMs, type HealthResponse } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";

/** Module health status */
interface ModuleHealth {
	readonly name: string;
	readonly healthy: boolean;
	readonly details: Record<string, unknown>;
}

/** Deep-check response extends the basic health shape with external service probes. */
export interface DeepHealthResponse extends HealthResponse {
	readonly filesystem: string;
	readonly checks: Readonly<Record<string, string>>;
	readonly modules: ReadonlyArray<ModuleHealth>;
}

/**
 * Optional injection token for module health indicators.
 * Each module registers its own health indicator that gets aggregated here.
 */
export const MODULE_HEALTH_INDICATORS = "MODULE_HEALTH_INDICATORS";

/** Interface for module health indicators */
export interface ModuleHealthIndicator {
	readonly isHealthy: () => Promise<boolean>;
	readonly getReport?: () => Promise<Record<string, unknown>>;
}

@Injectable()
export class HealthService {
	/** Set to true once the API has fully started (DB connected, Swagger built). */
	private ready = false;

	constructor(
		private readonly prisma: PrismaService,
		@Optional()
		@Inject(MODULE_HEALTH_INDICATORS)
		private readonly moduleIndicators: ReadonlyArray<{ readonly name: string; readonly indicator: ModuleHealthIndicator }> = [],
	) {}

	/** Mark the API as ready to serve (called from main.ts after startup). */
	public markReady(): void {
		this.ready = true;
	}

	public getHello(): string {
		return "Hello from the Freebuff API!";
	}

	public async healthCheck(): Promise<HealthResponse> {
		if (!this.ready) {
			throw new ServiceUnavailableException("API is starting up");
		}

		let dbStatus: string;
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			dbStatus = "connected";
		} catch {
			// Intentionally silent: health check reports the failure state, not the error.
			dbStatus = "disconnected";
		}

		return HealthResponseSchema.parse({
			status: "ok",
			db: dbStatus,
			timestamp: nowEpochMs(),
		});
	}

	public async deepHealthCheck(): Promise<DeepHealthResponse> {
		if (!this.ready) {
			throw new ServiceUnavailableException("API is starting up");
		}

		let dbStatus: string;
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			dbStatus = "connected";
		} catch {
			dbStatus = "disconnected";
		}

		// Run module health indicators
		const moduleHealthResults: ModuleHealth[] = [];
		for (const { name, indicator } of this.moduleIndicators) {
			try {
				const healthy = await indicator.isHealthy();
				const report = indicator.getReport !== undefined ? await indicator.getReport() : {};
				moduleHealthResults.push({ name, healthy, details: report });
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
}
