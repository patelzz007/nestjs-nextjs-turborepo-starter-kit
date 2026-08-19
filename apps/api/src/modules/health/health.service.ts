import { Injectable } from "@nestjs/common";

import { HealthResponseSchema, nowEpochMs, type HealthResponse } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service";

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
}
