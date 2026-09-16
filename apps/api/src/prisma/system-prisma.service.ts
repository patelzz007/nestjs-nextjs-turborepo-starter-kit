import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Dedicated Prisma client for system-level operations (migrations, initialization, etc.).
 *
 * Unlike PrismaService, this client:
 * - Does NOT use the RlsPool (no automatic SET ROLE app_runtime)
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

	public constructor() {
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

		super({
			log: logConfig,
		});

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
		this.logger.log("System database connection closed");
	}
}
