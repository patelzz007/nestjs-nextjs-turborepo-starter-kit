import { Global, Module } from "@nestjs/common";

import { LogService } from "./logs.service";

/**
 * Application-wide structured logging.
 *
 * `@Global()` so any module can inject `LogService` without declaring it as a
 * provider or importing this module — it only needs to be imported once in the
 * root `AppModule`. Cross-cutting infrastructure services (like the
 * `@Global()` ConfigModule) follow the same pattern; before this module
 * existed, every consumer had to remember to add `LogService` to its own
 * `providers`/`exports`, which produced duplicate registrations and module
 * coupling just to reach a logger.
 */
@Global()
@Module({
	providers: [LogService],
	exports: [LogService],
})
export class LogsModule {}
