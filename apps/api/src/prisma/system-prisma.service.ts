import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/**
 * Dedicated Prisma client for system-level operations (migrations, initialization, etc.).
 *
 * Unlike PrismaService, this client:
 * - Uses a standard pg.Pool (NOT the RlsPool, so no automatic SET ROLE app_runtime)
 * - Connects directly as the DATABASE_URL superuser
 * - Should ONLY be used for system operations, never for user requests
 *
 * Use cases:
 * - Module initialization (onModuleInit hooks)
 * - Permission/role migrations
 * - System configuration sync
 * - Database seeding
 *
 * Security note: This client bypasses RLS entirely. Only inject it into
 * services that genuinely need system-level access.
 */
@Injectable()
export class SystemPrismaService extends PrismaClient implements OnModuleDestroy {
	private readonly logger: Logger = new Logger(SystemPrismaService.name);
	private readonly pool: Pool;

	public constructor() {
		const pool = new Pool({ connectionString: process.env.DATABASE_URL });
		const adapter = new PrismaPg(pool);

		const logLevel: string = process.env.LOG_LEVEL ?? "warn";
		const isDebug: boolean = logLevel === "debug" || logLevel === "silly";

		type LogConfig = { readonly emit: "event"; readonly level: "query" | "info" | "warn" | "error" };
		const logConfig: LogConfig[] = isDebug
			? [
					{ emit: "event", level: "query" },
					{ emit: "event", level: "info" },
					{ emit: "event", level: "warn" },
					{ emit: "event", level: "error" },
				]
			: [{ emit: "event", level: "query" }];

		super({ adapter, log: logConfig });
		this.pool = pool;

		this.$on("error" as never, ((event: { message: string; target: string }) => {
			this.logger.error(`Prisma error: ${event.message} (target: ${event.target})`);
		}) as never);

		if (isDebug) {
			this.$on("query" as never, ((event: { query: string; duration: number }) => {
				this.logger.debug(`Query: ${event.query} (${String(event.duration)}ms)`);
			}) as never);
		}
	}

	public async onModuleDestroy(): Promise<void> {
		this.logger.log("Closing system database connection…");
		await this.$disconnect();
		await this.pool.end();
		this.logger.log("System database connection closed");
	}
}
