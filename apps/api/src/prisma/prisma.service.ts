import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor() {
		const pool = new Pool({ connectionString: process.env.DATABASE_URL });
		const adapter = new PrismaPg(pool);
		// Query events feed the Telescope SQL capture (docs/telescope.md §5.3).
		// NOTE: Prisma 7 driver adapters may not emit these — capture degrades
		// gracefully (no query rows) rather than crashing.
		super({ adapter, log: [{ emit: "event", level: "query" }] });
	}

	async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}
