import { Injectable } from "@nestjs/common";

import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class HealthService {
	constructor(private readonly prisma: PrismaService) {}

	public getHello(): string {
		return "Hello from the Freebuff API!";
	}

	public async healthCheck(): Promise<{ status: string; db: string; timestamp: number }> {
		let dbStatus: string;
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			dbStatus = "connected";
		} catch {
			dbStatus = "disconnected";
		}

		return {
			status: "ok",
			db: dbStatus,
			timestamp: nowEpochMs(),
		};
	}
}
