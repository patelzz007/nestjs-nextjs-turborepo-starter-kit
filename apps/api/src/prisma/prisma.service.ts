import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { RlsPool } from "./rls-pool";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	public constructor() {
		const pool = new RlsPool({ connectionString: process.env.DATABASE_URL });
		const adapter = new PrismaPg(pool);
		// Query events feed the Telescope SQL capture (docs/telescope.md §5.3).
		// NOTE: Prisma 7 driver adapters may not emit these — capture degrades
		// gracefully (no query rows) rather than crashing.
		super({ adapter, log: [{ emit: "event", level: "query" }] });
	}

	public async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	public async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}
