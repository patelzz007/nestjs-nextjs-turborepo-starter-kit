import { Injectable } from "@nestjs/common";

import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class AppService {
	constructor(private readonly prisma: PrismaService) {}

	public getHello(): string {
		return "Hello from the Freebuff API!";
	}

	public async healthCheck(): Promise<{ status: string; db: string; timestamp: string }> {
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
			timestamp: new Date().toISOString(),
		};
	}
}
