import { Injectable } from "@nestjs/common";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { HealthResponseSchema, nowEpochMs, type HealthResponse } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";

/** Deep-check response extends the basic health shape with external service probes. */
export interface DeepHealthResponse extends HealthResponse {
	readonly filesystem: string;
	readonly checks: Readonly<Record<string, string>>;
}

@Injectable()
export class HealthService {
	constructor(private readonly prisma: PrismaService) {}

	public getHello(): string {
		return "Hello from the Freebuff API!";
	}

	public async healthCheck(): Promise<HealthResponse> {
		let dbStatus: string;
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			dbStatus = "connected";
		} catch {
			dbStatus = "disconnected";
		}

		return HealthResponseSchema.parse({
			status: "ok",
			db: dbStatus,
			timestamp: nowEpochMs(),
		});
	}

	/** Deep health check: DB + filesystem + external service probes. */
	public async deepHealthCheck(): Promise<DeepHealthResponse> {
		const basic = await this.healthCheck();
		const checks: Record<string, string> = {};

		// Filesystem: check if the backup directory is writable.
		const backupDir: string = process.env.BACKUP_DIR ?? "./backups";
		try {
			await access(backupDir, fsConstants.W_OK);
			checks["filesystem"] = "writable";
		} catch {
			checks["filesystem"] = "not writable";
		}

		const degraded: boolean = basic.db !== "connected" || checks["filesystem"] !== "writable";
		return {
			...basic,
			status: degraded ? "degraded" : "ok",
			filesystem: checks["filesystem"],
			checks,
		};
	}
}
